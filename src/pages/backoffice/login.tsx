import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { KeyRoundIcon, Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { setBackofficeCode } from "@/lib/auth"

export function BackofficeLoginPage() {
  const navigate = useNavigate()
  const [code, setCode] = useState("JUIN26")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.authConfig().then((cfg) => setCode(cfg.defaultCode)).catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.verifyCode(code)
      setBackofficeCode(code)
      toast.success("Accès backoffice autorisé")
      navigate("/backoffice")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Code invalide")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRoundIcon className="text-primary" />
            Backoffice
          </CardTitle>
          <CardDescription>
            Entrez le code unique d&apos;accès (pas de login classique).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="code">Code d&apos;accès</FieldLabel>
                <Input
                  id="code"
                  value={code}
                  disabled={loading}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <Loader2Icon className="animate-spin" data-icon="inline-start" />
                ) : null}
                {loading ? "Vérification…" : "Accéder au backoffice"}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
