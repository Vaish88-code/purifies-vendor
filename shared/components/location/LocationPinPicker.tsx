import { useCallback, useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import { MapPin, Navigation, Loader2 } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Label } from '@shared/components/ui/label';
import { reverseGeocode } from '@shared/utils/geocoding';

export interface LocationPinValue {
  latitude: number;
  longitude: number;
  address: string;
  city?: string;
  suggestedState?: string;
  suggestedPincode?: string;
}

interface LocationPinPickerProps {
  value: LocationPinValue | null;
  onChange: (value: LocationPinValue) => void;
  label?: string;
}

const DEFAULT_CENTER: LatLngExpression = [20.5937, 78.9629];

function MapRecenter({ center }: { center: LatLngExpression }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

function MapClickHandler({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function LocationPinPicker({
  value,
  onChange,
  label = 'Pin your shop location on the map',
}: LocationPinPickerProps) {
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const position: LatLngExpression = value
    ? [value.latitude, value.longitude]
    : DEFAULT_CENTER;

  const resolveLocation = useCallback(
    async (lat: number, lng: number) => {
      setGeocoding(true);
      const result = await reverseGeocode(lat, lng);
      setGeocoding(false);

      onChange({
        latitude: lat,
        longitude: lng,
        address: result?.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        city: result?.city,
        suggestedState: result?.state,
        suggestedPincode: result?.pincode,
      });
    },
    [onChange]
  );

  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoading(false);
        resolveLocation(pos.coords.latitude, pos.coords.longitude);
      },
      () => setLoading(false),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="flex items-center gap-1.5">
          <MapPin className="h-4 w-4" />
          {label} *
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleLocateMe}
          disabled={loading}
          className="shrink-0"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Navigation className="h-4 w-4" />
          )}
          <span className="ml-1.5">Use my location</span>
        </Button>
      </div>

      <div className="rounded-lg overflow-hidden border h-[220px] relative z-0">
        <MapContainer
          center={position}
          zoom={value ? 16 : 5}
          className="h-full w-full"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onSelect={resolveLocation} />
          {value && (
            <>
              <MapRecenter center={position} />
              <Marker
                position={position}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const pos = e.target.getLatLng();
                    resolveLocation(pos.lat, pos.lng);
                  },
                }}
              />
            </>
          )}
        </MapContainer>
      </div>

      <p className="text-xs text-muted-foreground">
        Tap the map or drag the pin to set your shop location. Address fills automatically from coordinates.
      </p>

      {geocoding && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Looking up address…
        </p>
      )}

      {value && (
        <p className="text-xs text-muted-foreground font-mono">
          {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}
        </p>
      )}
    </div>
  );
}
