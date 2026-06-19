export function buildAmapMarkerUrl(latitude: number, longitude: number, label: string): string {
  const encodedLabel = encodeURIComponent(label);
  return `https://uri.amap.com/marker?position=${longitude},${latitude}&name=${encodedLabel}`;
}
