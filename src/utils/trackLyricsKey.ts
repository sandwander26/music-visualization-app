
export function makeTrackLyricsKey(fileName: string, byteSize: number): string {
  return `${fileName}\0${byteSize}`
}
