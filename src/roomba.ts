// SPDX-License-Identifier: Apache-2.0
// Copyright © 2021 Roberto Hidalgo <sbth@un.rob.mx>
import { getRobotIP, Local as connect } from 'dorita980'
import { createLogger } from './lib/log'
import Logger from 'winston'
import { loadCredentials } from './lib/credentials'

loadCredentials();
const logger = createLogger("roomba", process.env["LOG_LEVEL"] || "info");

enum VacuumState {
  Unknown = "unknown",
  Charging = "charging",
  Cleaning = "cleaning",
  Returning = "returning",
  Stop = "stop"
}

class Vacuum {
  public state: VacuumState
  public batteryLevel: number
  private bot: any
  private refreshPeriod: number = 1*60*1000 // 1m
  private loopPeriod: number = 1*60*1000 // 1m
  private refreshers: Map<string, NodeJS.Timer>
  private roamAtBattery: number = 75; // percentage to get before starting to clean
  private chargeAtBattery: number = 25; // percentage to get before returning to charge
  private l: Logger.Logger

  constructor(bot: any) {
    this.state = VacuumState.Unknown
    this.batteryLevel = 0
    this.bot = bot
    this.refreshers = new Map()
    this.l = createLogger("bot", process.env["LOG_LEVEL"] || "info")
  }

  public async initialize(): Promise<void> {
    await this.getMissionStatus()
    await this.getBatteryLevel()

    logger.info("class status", {
      "battery": this.batteryLevel,
      "state": this.state,
    })

    this.bot.on('update', (data:any)=> {
      logger.info("got update", data);
    });

    this.runLoop()
    this.setTimers()
  }

  public setTimers() {
    this.refreshers.set("battery", setInterval(async () =>{
      await this.getBatteryLevel()
      await this.getMissionStatus()
    }, this.refreshPeriod))
    this.refreshers.set("loop", setInterval(() => this.runLoop(), this.loopPeriod))
  }

  private runLoop() {
    switch (this.state) {
      case VacuumState.Cleaning:
      if (this.batteryLevel <= this.chargeAtBattery) {
        logger.info("RETURNING TO CHARGE")
        this.bot.stop()
        this.bot.dock()
      }
      break
      case VacuumState.Charging:
      if (this.batteryLevel >= this.roamAtBattery) {
        logger.info("STARTING CLEAN")
        this.bot.clean()
      }
      break
      case VacuumState.Stop:
      if (this.batteryLevel >= this.roamAtBattery) {
        logger.info("STARTING CLEAN")
        this.bot.clean()
      } else {
        logger.info("ALREADY STOPPED, RETURNING TO CHARGE")
        this.bot.dock()
      }
      case VacuumState.Returning, VacuumState.Unknown:
      break
    }
  }

  public async getBatteryLevel(): Promise<number> {
    let state = await this.bot.getRobotState(['batPct'])
    if (this.batteryLevel != state.batPct) {
      this.l.info("Battery level changed", {from: this.batteryLevel, to: state.batPct, status: this.state})
    }
    this.batteryLevel = state.batPct
    return this.batteryLevel
  }

  public async getMissionStatus(): Promise<VacuumState> {
    let state = await this.bot.getRobotState(['cleanMissionStatus'])
    const status = state.cleanMissionStatus.phase
    let newState: VacuumState | undefined
    this.l.info("got mission status", {cycle: state.cleanMissionStatus.cycle, status: status})
    switch (status) {
      case "charge":
      newState = VacuumState.Charging
      break
      case "run":
      newState = VacuumState.Cleaning
      break
      case "hmUsrDock":
      newState = VacuumState.Returning
      break
      case "stop":
      newState = VacuumState.Stop
      break
      default:
      logger.warn(`Unknown charge state: ${status}`)
    }

    if (newState && newState != this.state) {
      this.l.info("updating state",  {from: this.state, to: newState})
      this.state = newState
    }

    return this.state
  }


  public shutdown(timeout: NodeJS.Timer): void {
    this.bot.stop()
    this.bot.dock()
    this.bot.end()
    logger.info("Shutdown complete")
    // clearTimeout(timeout)
    // process.exit(0)
  }

}


(async function main(){
  logger.info("Looking for roomba's ip")
  let ip: string
  try {
    ip = await new Promise((resolve, reject) => {
      getRobotIP((err: Error, ip: string)=> {
        if (err) return reject(err)
        return resolve(ip)
      })
    })
  } catch (err) {
    logger.error(err)
    return
  }

  logger.info(`Got ip: ${ip}`)

  var bot = connect(
    process.env["ROOMBA_USERNAME"] || "",
    process.env["ROOMBA_PASSWORD"] || "",
    ip
    )

    const roomba = new Vacuum(bot)

    async function shutdown (code: any){
      logger.warn(`${code} received, shutting down in 5 seconds...`)
      const to = setTimeout(process.exit, 5000)
      roomba.shutdown(to)
    }
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);

    roomba.initialize()
  })()
