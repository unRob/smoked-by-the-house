// SPDX-License-Identifier: Apache-2.0
// Copyright © 2021 Roberto Hidalgo <sbth@un.rob.mx>
import ecovacsDeebot from 'ecovacs-deebot'
import VacBot from 'ecovacs-deebot/types/library/vacBot'
const EcoVacsAPI = ecovacsDeebot.EcoVacsAPI
import * as nodeMachineId from 'node-machine-id'

import { createLogger } from './lib/log'
import { loadCredentials } from './lib/credentials'

loadCredentials();

const logger = createLogger("yeedi", process.env["LOG_LEVEL"] || "info")
const countryCode = "mx";
const device_id = EcoVacsAPI.getDeviceId(nodeMachineId.machineIdSync(), 0);
const continent = ecovacsDeebot.countries[countryCode.toUpperCase()].continent.toLowerCase();
const authDomain = 'yeedi.com';


async function Vacbots(username: string, password: string) : Promise<VacBot[]> {
  logger.info("Connecting to API")
  let api = new EcoVacsAPI(device_id, countryCode, continent, authDomain)

  try {
    await api.connect(username, EcoVacsAPI.md5(password))
  } catch (err) {
    throw new Error(`Could not connect to API: ${err}`)
  }
  logger.info("Connected to API, fetching devices")

  let devices = []
  try {
    devices = await api.devices()
  } catch (err) {
    err = new Error(`Could not fetch devices from API: ${err}`)
    throw err
  }

  let results = []
  let vacbots: VacBot[] = []

  logger.info(`Fetched ${devices.length} devices`)
  for (let dev in devices) {
    try {
      let device = devices[dev]
      let vacbot = api.getVacBot(api.uid, EcoVacsAPI.REALM, api.resource, api.user_access_token, device, continent);
      vacbot.connect()
      results.push(new Promise((resolve, _) => {
        vacbot.on('ready', () => {
          resolve(vacbot)
        })

      }))
    } catch (err) {
      err = new Error(`Could not connect to device #${dev} ${devices[dev]}: ${err}`)
      throw err
    }
  }

  const ready_evts = await Promise.all(results)
  ready_evts.forEach((vacbot) => {
    let bot = vacbot as VacBot
    logger.debug(`Connected to device: ${bot}`)
    vacbots.push(bot)
  })

  logger.info("Vacbots ready")
  return vacbots
}


enum VacuumState {
  Unknown = "unknown",
  Charging = "charging",
  Cleaning = "cleaning",
  Returning = "returning",
  Idle = "idle",
}

class Vacuum {
  public state: VacuumState
  public batteryLevel: number
  private bot: VacBot
  private getTimeout: number = 10*1000 // 10s
  private refreshPeriod: number = 5*60*1000 // 5m
  private loopPeriod: number = 1*60*1000 // 5m
  private refreshers: Map<string, NodeJS.Timer>
  private roamAtBattery: number = 75; // percentage to get before starting to clean
  private chargeAtBattery: number = 25; // percentage to get before returning to charge

  constructor(bot: VacBot) {
    this.state = VacuumState.Unknown
    this.batteryLevel = 0
    this.bot = bot
    this.refreshers = new Map()
  }

  public async initialize(): Promise<void> {
    this.bot.on('Error', (err: any) => {
      logger.error('Error: ', {error: err});
    });

    this.bot.on('messageReceived', (value: any) => {
      logger.debug('messageReceived', {value: value});
    });

    this.bot.on("CurrentStats", (state: object) => {
      logger.info(`got stats`, state);
    });

    this.bot.on("ChargeState", (state: string) => {
      logger.info(`got charge state: ${state}`);
    });

    this.bot.on("clean", (state: string) => {
      logger.info(`got clean state: ${state}`);
    });

    this.bot.on("CleanInfo", (state: any) => {
      logger.info(`got clean info: ${state}`);
    });


    this.bot.on('CleanReport', (state: string) => {
      // happens when returning or idle, maybe more
      switch (state) {
        case "returning":
        this.state = VacuumState.Returning
        break;
        case "idle":
        this.state = VacuumState.Idle
        break;
        case "auto":
        this.state = VacuumState.Cleaning
        break;
        default:
        console.warn(`Unhandled report state: ${state}`)
      }
    });

    await this.getChargeState()
    await this.getBatteryLevel()

    logger.info("class status", {
      "battery": this.batteryLevel,
      "state": this.state,
    })


    this.runLoop()
    this.setTimers()
  }

  public setTimers() {
    this.refreshers.set("battery", setInterval(() => this.getBatteryLevel(), this.refreshPeriod))
    this.refreshers.set("charge", setInterval(() => this.getChargeState(), this.refreshPeriod))
    this.refreshers.set("loop", setInterval(() => this.runLoop(), this.loopPeriod))
  }

  private runLoop() {
    switch (this.state) {
      case VacuumState.Cleaning:
      if (this.batteryLevel <= this.chargeAtBattery) {
        logger.info("RETURNING TO CHARGE")
        this.bot.run("Charge")
      }
      break
      case VacuumState.Charging:
      if (this.batteryLevel >= this.roamAtBattery) {
        logger.info("STARTING CLEAN")
        this.bot.run("Clean")
      }
      break
      case VacuumState.Idle:
      if(this.batteryLevel <= this.chargeAtBattery)  {
        logger.info("RETURNING TO CHARGE")
        this.bot.run("Charge")
      } else {
        logger.info("STARTING CLEAN")
        this.bot.run("Clean")
      }

      break
      case VacuumState.Returning, VacuumState.Unknown:
      break
    }
  }

  public async getBatteryLevel(): Promise<number> {
    return await new Promise((resolve, reject) => {
      let timeout: NodeJS.Timeout
      this.bot.once("BatteryInfo", (battery: number) => {
        logger.debug(`got battery info: ${battery}`);
        clearTimeout(timeout)
        this.batteryLevel = Math.round(battery)
        resolve(this.batteryLevel)
      });
      logger.debug("querying for battery info");
      this.bot.run('GetBatteryState')
      timeout = setTimeout(function() { reject("Did not get battery info before timeout") }, this.getTimeout)
    })
  }

  public async getChargeState(): Promise<VacuumState> {
    return await new Promise((resolve, reject) => {
      let timeout: NodeJS.Timeout
      this.bot.once("ChargeState", (state: string) => {
        clearTimeout(timeout)
        if (state == this.state.toString()) {
          return
        }
        logger.info(`changing state from ${this.state} to ${state}`);
        switch (state) {
          case "charging":
          this.state = VacuumState.Charging;
          break
          case "idle":
          this.state = VacuumState.Idle;
          break
          case "auto":
          this.state = VacuumState.Cleaning;
          break
          default:
          logger.error(`Unknown device state: ${state}, ${typeof state}`)
        }
        resolve(this.state)
      });
      logger.debug("querying for charge state");
      this.bot.run('GetChargeState')
      timeout = setTimeout(function() { reject("Did not get charge state before timeout") }, this.getTimeout)
    })
  }


  public shutdown(): void {
    this.refreshers.forEach(clearInterval)
    this.bot.run("Charge")
    this.bot.disconnect()
  }

}


(async function() {
  let bots: VacBot[]
  try {
    bots = await Vacbots(process.env["YEEDI_USERNAME"] || "", process.env["YEEDI_PASSWORD"] || "")
  } catch (err) {
    // let message: string
    // if (err instanceof Error) message = err.message
    // else message = String(err)
    logger.error(`Failing catastrophically: ${err}`)
    process.exit(2)
  }

  const vacuums = new Array<Vacuum>()
  for (let i in bots) {
    let bot = bots[i]
    let vacuum = new Vacuum(bot)
    await vacuum.initialize()
    vacuums.push(vacuum)
  }

  async function shutdown (code: any){
    logger.warn(`${code} received, shutting down in 5 seconds...`)

    for (let i in vacuums) {
      let bot = vacuums[i]
      bot.shutdown()
    }

    setTimeout(process.exit, 5000)
  }
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
})()
