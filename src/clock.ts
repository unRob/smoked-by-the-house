// SPDX-License-Identifier: Apache-2.0
// Copyright © 2021 Roberto Hidalgo <sbth@un.rob.mx>
import puppeteer from 'puppeteer-core'
const MY_NETWORK_BUTTON = "#time"
import { createLogger } from './lib/log'

const logger = createLogger("clock", process.env["LOG_LEVEL"] || "info")


interface SoundLoaded {
  found?: boolean
  reject?: (value: unknown) => void
  resolve?: (value: unknown) => void
}

type ObjectKey = "reject" | "resolve"

const EXPECTED_SOUNDS: Record<string,SoundLoaded> = {
  'thirdstroke': {},
  'seconds': {},
  'precisely': {},
  'and': {},
  'oclock': {},
  'stroke': {},
  '1': {},
  '2': {},
  '3': {},
  '4': {},
  '5': {},
  '6': {},
  '7': {},
  '8': {},
  '9': {},
  '10': {},
  '11': {},
  '12': {},
  '13': {},
  '14': {},
  '15': {},
  '16': {},
  '17': {},
  '18': {},
  '19': {},
  '20': {},
  '30': {},
  '40': {},
  '50': {}
}

class Clock {
  private browser?: puppeteer.Browser
  private page?: puppeteer.Page
  private loadedSounds: Promise<any>[]
  private urlPrefix = "https://1194online.com/audio/m4a/"

  constructor(){
    this.loadedSounds = []
    for (let key in EXPECTED_SOUNDS) {
      this.loadedSounds.push(new Promise((resolve, reject) => {
        EXPECTED_SOUNDS[key].resolve = resolve
        EXPECTED_SOUNDS[key].reject = reject
        delete(EXPECTED_SOUNDS[key].found)
      }))
    }
  }

  public async start(): Promise<void> {
    logger.info("Starting clock")
    try {
      this.browser = await this.createBrowser()
    } catch (err) {
      throw new Error(`Failed to create browser: ${err}`)
    }

    try {
      this.page = await this.loadPage()
    } catch (err) {
      throw new Error(`Failed to load page: ${err}`)
    }

    this.setListeners()

    await this.page?.goto('https://1194online.com');
    logger.info(`loaded page ${this.page?.url()}`);

    await this.page?.waitForSelector(MY_NETWORK_BUTTON, {visible: true});
    logger.debug('selector visible');
    await this.page?.click(MY_NETWORK_BUTTON)
    logger.info('Triggered load of sounds');

    return await Promise.all(this.loadedSounds).then(() => { logger.info("Clock started"); })
  }

  public async stop(): Promise<void> {
    return this.browser?.close()
  }

  private async createBrowser(): Promise<puppeteer.Browser>{
    return await puppeteer.launch({
      product: "firefox",
      executablePath: "/usr/bin/firefox",
      headless: true,
      ignoreDefaultArgs: [
        "--mute-audio",
      ],
      args: [
        // "--alsa-output-device=hw:0,0",
        "--no-sandbox",
        '--disable-setuid-sandbox',
        "--use-fake-ui-for-media-stream",
        "--autoplay-policy=no-user-gesture-required",
      ]
    })
  }

  private async loadPage(): Promise<any>{
    if (!this.browser ) {
      return Promise.reject()
    }

    return await this.browser?.newPage();
  }

  private handleAudioLoad(url: string, success: boolean) {
    if (url.startsWith(this.urlPrefix)) {
      const key = url.replace(this.urlPrefix, "").replace(".aif.m4a", "")
      const file = EXPECTED_SOUNDS[key]
      let fn = (success ? "resolve" : "reject") as ObjectKey
      if (file && file[fn]) {
        let fn2 = file[fn]
        logger.info(`Audio loaded: ${url}`)
        fn2 && fn2(true)
      } else {
        logger.error(`Unknown audio resource: ${url}`)
      }
    }
  }

  private setListeners() {
    let urlPrefix = this.urlPrefix
    this.page?.on('console', message => logger.debug(`${message.type().substr(0, 3).toUpperCase()} ${message.text()}`))

    this.page?.on('pageerror', ({ message }) => logger.error(`page error: ${message}`))
    this.page?.on('response', response => {
      let url = response.url()
      let status = response.status()
      logger.debug(`request response: ${status} ${url}`)
      this.handleAudioLoad(url, status <= 299)
    })
    this.page?.on('requestfailed', request => {
      let url = request.url()
      logger.error(`request failure: ${request.failure()?.errorText} ${request.url()}`)
      this.handleAudioLoad(url, false)
    })
  }

}

(async function() {
  const clock = new Clock()

  async function shutdown(code: any) {
    logger.warn(`${code} received, shutting down in 5 seconds...`)

    const to = setTimeout(() => {
      logger.error("Force killing after 5 seconds")
      process.exit(0)
    }, 5000)
    await clock.stop()
    logger.info("Browser stopped, clock clear to shutdown")
    clearTimeout(to)
    process.exit(0)
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)

  await clock.start()
})()
