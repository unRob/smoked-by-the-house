// SPDX-License-Identifier: Apache-2.0
// Copyright © 2021 Roberto Hidalgo <sbth@un.rob.mx>
import winston from 'winston'

export function createLogger(moduleName:string, level: string = "info") {
  return winston.createLogger({
    level: level,
    format: winston.format.json(),
    defaultMeta: { service: moduleName },
    transports: [
      //
      // - Write all logs with importance level of `error` or less to `error.log`
      // - Write all logs with importance level of `info` or less to `combined.log`
      //
      // new winston.transports.File({ filename: 'error.log', level: 'error' }),
      // new winston.transports.File({ filename: 'combined.log' }),
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
          ),
        })
      ],
    });
  }
