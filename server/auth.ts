import type { Request, Response, NextFunction } from "express"

import { getSetting } from "./db.js"

export const DEFAULT_BACKOFFICE_CODE = "JUIN26" as const

export function getBackofficeCode(): string {
  return getSetting("backoffice_code") ?? DEFAULT_BACKOFFICE_CODE
}

export function verifyBackofficeCode(code: string): boolean {
  return code.trim() === getBackofficeCode()
}

export function requireBackoffice(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const headerCode = req.header("X-Backoffice-Code")
  const bodyCode =
    typeof req.body?.code === "string" ? req.body.code : undefined
  const code = headerCode ?? bodyCode

  if (!code || !verifyBackofficeCode(code)) {
    res.status(401).json({ error: "Code backoffice invalide" })
    return
  }

  next()
}
