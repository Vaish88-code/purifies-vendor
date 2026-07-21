export interface ReverseGeocodeResult {
  address: string;
  city?: string;
  state?: string;
  pincode?: string;
}

/** Reverse geocode coordinates to a street address (OpenStreetMap Nominatim). */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Purifies/1.0' },
    });
    if (!res.ok) return null;

    const data = await res.json();
    const addr = data.address;
    if (!addr) return null;

    const parts = [
      addr.house_number,
      addr.road || addr.pedestrian || addr.footway,
      addr.suburb || addr.neighbourhood || addr.quarter,
      addr.city || addr.town || addr.village || addr.county,
    ].filter(Boolean);

    const state =
      addr.state ||
      addr['state_district'] ||
      addr.region;
    const pincode = addr.postcode?.replace(/\D/g, '').slice(0, 6) || undefined;
    const city = addr.city || addr.town || addr.village || addr.county;

    return {
      address: parts.length > 0 ? parts.join(', ') : data.display_name?.split(',').slice(0, 4).join(', ') || '',
      city,
      state,
      pincode: pincode?.length === 6 ? pincode : undefined,
    };
  } catch {
    return null;
  }
}
