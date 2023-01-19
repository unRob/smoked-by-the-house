// SPDX-License-Identifier: Apache-2.0
// Copyright © 2021 Roberto Hidalgo <sbth@un.rob.mx>
import { readFileSync } from "fs"

export function loadCredentials() {
  let str = readFileSync("./.credentials")
  const data = JSON.parse(str.toString("utf-8"))
  for (let k in data) {
    if (!(k in process.env)) {
      process.env[k] = data[k]
    }
  }
}
