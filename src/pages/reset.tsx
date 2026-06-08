import { useState } from "react"
import { AlertTriangleIcon, Loader2Icon, RotateCcwIcon } from "lucide-react"

import { LoadingOverlay } from "@/components/loading-overlay"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { api } from "@/lib/api"

export function ResetPage() {
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  async function handleReset() {
    setDialogOpen(false)
    setLoading(true)
    try {
      const result = await api.resetData()
      toast.success(result.message)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Échec")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex flex-col gap-6">
      <LoadingOverlay
        open={loading}
        variant="destructive"
        title="Réinitialisation en cours…"
        description="Suppression des données NewApp et GLPI, veuillez patienter."
      />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Réinitialisation
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Remet à zéro NewApp (SQLite) et supprime le parc + tickets dans GLPI
          ExistingApp.
        </p>
      </div>

      <Card className="max-w-xl border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangleIcon />
            Zone sensible
          </CardTitle>
          <CardDescription>
            Cette action efface l&apos;historique local et supprime les tickets
            dans GLPI via l&apos;API REST (JSON).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            <li>· Historique des imports SQLite supprimé</li>
            <li>· Tickets importés via NewApp supprimés dans GLPI</li>
            <li>· Ordinateurs, écrans, imprimantes supprimés dans GLPI</li>
            <li>· Tous les tickets GLPI purgés (force_purge)</li>
            <li>· Code backoffice et connexion GLPI conservés</li>
          </ul>

          <AlertDialog
            open={dialogOpen}
            onOpenChange={(open) => !loading && setDialogOpen(open)}
          >
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={loading}>
                {loading ? (
                  <Loader2Icon className="animate-spin" data-icon="inline-start" />
                ) : (
                  <RotateCcwIcon data-icon="inline-start" />
                )}
                {loading ? "Réinitialisation…" : "Réinitialiser NewApp et GLPI"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmer la réinitialisation ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Les données locales seront effacées et les tickets seront
                  définitivement supprimés dans GLPI ExistingApp. Cette action
                  est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={loading}
                  onClick={(e) => {
                    e.preventDefault()
                    void handleReset()
                  }}
                >
                  Oui, tout réinitialiser
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  )
}
