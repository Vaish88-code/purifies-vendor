import { ReactNode } from 'react';
import { Truck, MapPin, Phone, User, Navigation } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Card, CardContent } from '@shared/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@shared/components/ui/dialog';
import { FirestoreUser, Vendor } from '@shared/lib/firebase/firestore';
import {
  deriveCityTokenFromAddress,
  distanceMetersShopToPerson,
  formatKmNumber,
} from '@shared/utils/geo';

interface DriverAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  vendor: Vendor | null;
  deliveryPersons: FirestoreUser[];
  loading: boolean;
  summary: ReactNode;
  onAssign: (person: FirestoreUser) => void;
  assigning?: boolean;
  showEta?: boolean;
}

export function DriverAssignmentDialog({
  open,
  onOpenChange,
  title = 'Select Delivery Person',
  description = 'Choose an available delivery person. Distance from your shop is shown in kilometers when GPS is set for the shop and the driver.',
  vendor,
  deliveryPersons,
  loading,
  summary,
  onAssign,
  assigning = false,
  showEta = false,
}: DriverAssignmentDialogProps) {
  const availableCount = deliveryPersons.filter((p) => p.isAvailable !== false).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {summary && (
          <Card className="mt-4 bg-muted/50">
            <CardContent className="p-4">{summary}</CardContent>
          </Card>
        )}

        <div className="space-y-4 mt-4">
          {loading ? (
            <p className="text-center text-muted-foreground py-4">Loading delivery persons...</p>
          ) : deliveryPersons.length === 0 ? (
            <div className="text-center py-8">
              <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">No delivery persons available</p>
              <p className="text-sm text-muted-foreground">
                Same-city drivers appear here. Shop city:{' '}
                {(vendor?.city || deriveCityTokenFromAddress(vendor?.address) || '').trim() ||
                  'not set — add in Shop Settings'}
                {vendor?.pincode ? ` · Pincode: ${vendor.pincode}` : ''}.
              </p>
              <Button variant="outline" className="mt-4" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {availableCount} available · {deliveryPersons.length} total
              </p>
              <div className="grid gap-3 max-h-[400px] overflow-y-auto">
                {deliveryPersons.map((person) => {
                  const isAvailable = person.isAvailable !== false;
                  const distM = distanceMetersShopToPerson(
                    vendor?.latitude,
                    vendor?.longitude,
                    person.latitude,
                    person.longitude
                  );
                  let etaLabel: string | null = null;
                  if (showEta && distM != null) {
                    const distanceKm = distM / 1000;
                    const etaMinutes = Math.max(3, Math.round((distanceKm / 20) * 60));
                    etaLabel = `~${etaMinutes} min to reach shop`;
                  }

                  return (
                    <div
                      key={person.uid}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        isAvailable
                          ? 'border-border bg-muted/30 hover:border-primary'
                          : 'border-muted-foreground/30 bg-muted/30 opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2 rounded-lg ${
                            isAvailable ? 'bg-primary/10' : 'bg-muted-foreground/10'
                          }`}
                        >
                          <User
                            className={`h-5 w-5 ${
                              isAvailable ? 'text-primary' : 'text-muted-foreground'
                            }`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className={`font-semibold ${!isAvailable ? 'text-muted-foreground' : ''}`}>
                              {person.name}
                            </p>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                isAvailable
                                  ? 'bg-success/20 text-success'
                                  : 'bg-muted-foreground/20 text-muted-foreground'
                              }`}
                            >
                              {isAvailable ? 'Available' : 'Unavailable'}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-sm flex-wrap">
                            <Navigation className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                            <span>
                              {distM != null ? (
                                <>
                                  <span className="font-semibold tabular-nums">{formatKmNumber(distM)} km</span>
                                  {etaLabel && (
                                    <span className="text-muted-foreground ml-2">{etaLabel}</span>
                                  )}
                                </>
                              ) : (
                                <span className="text-muted-foreground text-xs">
                                  Distance unavailable — set shop GPS in Settings
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 shrink-0" />
                              <a href={`tel:${person.phone}`} className="hover:underline">
                                {person.phone}
                              </a>
                            </div>
                            {person.address && (
                              <div className="flex items-start gap-2">
                                <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                                <span>{person.address}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {assigning ? (
                          <span className="text-sm text-muted-foreground shrink-0">Assigning...</span>
                        ) : isAvailable ? (
                          <Button size="sm" className="shrink-0" onClick={() => onAssign(person)}>
                            Assign
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground shrink-0">Unavailable</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={assigning}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
