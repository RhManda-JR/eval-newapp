import { Navigate, Outlet, useLocation } from "react-router-dom"

import { getBackofficeCode } from "@/lib/auth"

export function BackofficeGuard() {
  const location = useLocation()
  const code = getBackofficeCode()

  if (!code) {
    return (
      <Navigate
        to="/backoffice/entree"
        replace
        state={{ from: location.pathname }}
      />
    )
  }

  return <Outlet />
}
