import * as mm from 'music-metadata-browser'
import { useAudioStore } from '../store/audioStore'
import { BeatDetector } from './beatDetector'
import { parseLrc } from '../utils/lrcParser'
import { loadTrackBytes, audioMimeFromPath } from '../library/persistence'
import { enrichNowPlayingCover } from './enrichNowPlayingCover'
import { tryAutoAttachLyricsFromCatalog, applyCatalogLabelsIfPossible } from './autoLyrics'
import { readLyricsDiskCache, writeLyricsDiskCache } from '../services/lyricsDiskCache'
import { mergeTrackDisplayFromFilename, catalogLabelsPlausibleForFile, metadataWeakForAutoLyrics } from '../utils/filenameMeta'
import { useSettingsStore, maybeEnableKaraokeOverlay } from '../store/settingsStore'
import { processSystemAudioFrame } from './systemAudioCapture'

export class AudioEngine {
  audioContext: AudioContext
  analyser: AnalyserNode
  source: AudioBufferSourceNode | null = null
  gainNode: GainNode
  dataArray: Float32Array

  private beatDetector = new BeatDetector()
  private buffer: AudioBuffer | null = null
  private originalBytes: Uint8Array | null = null
  private startedAt = 0
  private pauseOffset = 0
  private playing = false
  private rafId = 0
  private loadCounter = 0
  private systemModeStartTime = 0

  onTrackEnd: (() => void) | null = null

  markSystemStart(): void {
    this.systemModeStartTime = performance.now()
  }

  private disposeSource(): void {
    if (!this.source) return
    this.source.onended = null
    try {
      this.source.stop()
    } catch {
      /* уже остановлен */
    }
    try {
      this.source.disconnect()
    } catch {
      /* уже отключён */
    }
    this.source = null
  }

  private resetAnalysisState(): void {
    this.beatDetector.reset()
    const store = useAudioStore.getState()
    store.setAudioData(new Float32Array(this.dataArray.length))
    store.setEnergy(0)
    store.setBeat(false)
  }

  constructor() {
    this.audioContext = new AudioContext()
    this.gainNode = this.audioContext.createGain()
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 2048
    this.dataArray = new Float32Array(1024)
    this.gainNode.connect(this.analyser)
    this.analyser.connect(this.audioContext.destination)
  }

  private loop = (): void => {
    this.tick()
    this.rafId = requestAnimationFrame(this.loop)
  }

  startLoop(): void {
    if (this.rafId) return
    this.loop()
  }

  stopLoop(): void {
    cancelAnimationFrame(this.rafId)
    this.rafId = 0
  }

  private async runLyricsPreparePipeline(loadId: number): Promise<void> {
    if (loadId !== this.loadCounter) return
    const store = useAudioStore.getState()
    store.setTrackPrepareBusy(true)
    try {
      const dur = this.buffer?.duration
      const d = dur != null && dur > 0 ? dur : undefined
      if (useSettingsStore.getState().autoSearchLyrics) {
        const lyricsResult = await tryAutoAttachLyricsFromCatalog(d)
        const stAfter = useAudioStore.getState()
        const needCatalogHydration =
          lyricsResult === 'skipped_lines' ||
          (lyricsResult === 'skipped_mutex' && stAfter.lrcLines.length > 0)
        if (needCatalogHydration) {
          void applyCatalogLabelsIfPossible(d)
        }
      }
      maybeEnableKaraokeOverlay()
    } finally {
      useAudioStore.getState().setTrackPrepareBusy(false)
    }
  }

  async loadFile(file: File): Promise<void> {
    this.disposeSource()
    this.pauseOffset = 0
    this.playing = false
    this.buffer = null
    this.resetAnalysisState()

    const store = useAudioStore.getState()
    store.setLrcLines([])
    store.setIsPlaying(false)
    store.setCurrentTime(0)
    store.setCatalogLabelsFromDiskCache(false)

    const myLoadId = ++this.loadCounter

    const arrayBuffer = await file.arrayBuffer()
    if (myLoadId !== this.loadCounter) return

    this.originalBytes = new Uint8Array(arrayBuffer.slice(0))

    store.setSourceFileName(file.name)
    store.setSourceFileSize(file.size)

    const decodeCopy = arrayBuffer.slice(0)
    await Promise.all([
      this.audioContext.decodeAudioData(decodeCopy).then((buf) => {
        if (myLoadId === this.loadCounter) this.buffer = buf
      }),
      this.extractTags(file, myLoadId),
    ])
    if (myLoadId !== this.loadCounter) return

    const st = useAudioStore.getState()
    const weakMeta = metadataWeakForAutoLyrics({
      tagArtist: st.trackInfo.artist,
      tagTitle: st.trackInfo.title,
      sourceFileName: file.name,
    })
    if (st.lrcLines.length === 0 && !weakMeta) {
      const cached = readLyricsDiskCache(file.name, file.size)
      if (cached) {
        const fromDisk = parseLrc(cached.raw)
        if (fromDisk.length > 0) {
          st.setLrcLines(fromDisk)
          if (cached.catalogArtist?.trim() || cached.catalogTitle?.trim()) {
            if (
              catalogLabelsPlausibleForFile(file.name, cached.catalogArtist, cached.catalogTitle)
            ) {
              st.applyCatalogTrackLabels(cached.catalogArtist, cached.catalogTitle)
              st.setCatalogLabelsFromDiskCache(true)
            }
          }
        }
      }
    }

    maybeEnableKaraokeOverlay()

    this.startLoop()
    await this.runLyricsPreparePipeline(myLoadId)
  }

  async loadFromPath(audioPath: string, displayFileName?: string | null): Promise<void> {
    this.disposeSource()
    this.pauseOffset = 0
    this.playing = false
    this.buffer = null
    this.resetAnalysisState()

    const store = useAudioStore.getState()
    store.setLrcLines([])
    store.setIsPlaying(false)
    store.setCurrentTime(0)
    store.setCatalogLabelsFromDiskCache(false)

    const myLoadId = ++this.loadCounter

    const bytes = await loadTrackBytes(audioPath)
    if (myLoadId !== this.loadCounter) return

    const filename =
      (displayFileName && displayFileName.trim()) ||
      audioPath.split(/[/\\]/).pop() ||
      'track'
    const mime = audioMimeFromPath(audioPath)

    const arrayBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer

    this.originalBytes = new Uint8Array(arrayBuffer.slice(0))

    store.setSourceFileName(filename)
    store.setSourceFileSize(bytes.byteLength)

    const synthFile = new File([new Uint8Array(this.originalBytes)], filename, { type: mime })

    await Promise.all([
      this.audioContext.decodeAudioData(arrayBuffer.slice(0)).then((buf) => {
        if (myLoadId === this.loadCounter) this.buffer = buf
      }),
      this.extractTags(synthFile, myLoadId),
    ])
    if (myLoadId !== this.loadCounter) return

    const st = useAudioStore.getState()
    const weakMeta = metadataWeakForAutoLyrics({
      tagArtist: st.trackInfo.artist,
      tagTitle: st.trackInfo.title,
      sourceFileName: filename,
    })
    if (st.lrcLines.length === 0 && !weakMeta) {
      const cached = readLyricsDiskCache(filename, bytes.byteLength)
      if (cached) {
        const fromDisk = parseLrc(cached.raw)
        if (fromDisk.length > 0) {
          st.setLrcLines(fromDisk)
          if (cached.catalogArtist?.trim() || cached.catalogTitle?.trim()) {
            if (
              catalogLabelsPlausibleForFile(
                filename,
                cached.catalogArtist,
                cached.catalogTitle,
              )
            ) {
              st.applyCatalogTrackLabels(cached.catalogArtist, cached.catalogTitle)
              st.setCatalogLabelsFromDiskCache(true)
            }
          }
        }
      }
    }

    maybeEnableKaraokeOverlay()

    this.startLoop()
    await this.runLyricsPreparePipeline(myLoadId)
  }

  loadLrcFromText(raw: string): boolean {
    const trimmed = raw.trim()
    const parsed = parseLrc(trimmed)
    if (parsed.length === 0) return false
    useAudioStore.getState().setLrcLines(parsed)
    const name = useAudioStore.getState().sourceFileName
    const size = useAudioStore.getState().sourceFileSize
    if (name != null && size != null) writeLyricsDiskCache(name, size, trimmed)
    maybeEnableKaraokeOverlay()
    return true
  }

  async loadLrcFile(file: File): Promise<boolean> {
    const raw = await file.text()
    return this.loadLrcFromText(raw)
  }

  private async extractTags(file: File, loadId: number): Promise<void> {
    const fallbackTitle = file.name.replace(/\.[^/.]+$/, '')
    const store = useAudioStore.getState()

    try {
      const metadata = await mm.parseBlob(file)
      if (loadId !== this.loadCounter) return

      const { title, artist, album } = metadata.common
      const picture = metadata.common.picture?.[0]
      let cover = ''

      if (picture) {
        const blob = new Blob([picture.data], { type: picture.format })
        cover = URL.createObjectURL(blob)
      }

      let info = {
        title: title || fallbackTitle,
        artist: artist || '',
        album: album || '',
        cover,
      }
      info = mergeTrackDisplayFromFilename(file.name, info)
      store.setTrackInfo(info)

      const lyricsArr = metadata.common.lyrics
      if (lyricsArr?.length) {
        const raw = lyricsArr.filter(Boolean).join('\n').trim()
        if (raw.length > 0 && /\[\d{1,2}:\d{2}/.test(raw)) {
          const parsed = parseLrc(raw)
          if (parsed.length > 0) {
            store.setLrcLines(parsed)
            writeLyricsDiskCache(file.name, file.size, raw)
          }
        }
      }

      if (!cover) {
        const anchor = { fileName: file.name, fileSize: file.size }
        void enrichNowPlayingCover(info.artist, info.title, metadata.format.duration, anchor)
      }
    } catch {
      if (loadId !== this.loadCounter) return
      let info = {
        title: fallbackTitle,
        artist: '',
        album: '',
        cover: '',
      }
      info = mergeTrackDisplayFromFilename(file.name, info)
      store.setTrackInfo(info)
      const anchor = { fileName: file.name, fileSize: file.size }
      void enrichNowPlayingCover(info.artist, info.title, undefined, anchor)
    }
  }

  play(): void {
    if (useAudioStore.getState().trackPrepareBusy) return
    if (!this.buffer || this.playing) return

    this.disposeSource()

    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume()
    }

    this.source = this.audioContext.createBufferSource()
    this.source.buffer = this.buffer
    this.source.connect(this.gainNode)
    this.source.start(0, this.pauseOffset)

    this.startedAt = this.audioContext.currentTime - this.pauseOffset
    this.playing = true

    this.source.onended = () => {
      if (!this.playing) return
      const hook = this.onTrackEnd
      this.stop()
      if (hook) hook()
    }

    useAudioStore.getState().setIsPlaying(true)
    this.startLoop()
  }

  pause(): void {
    if (!this.playing) return

    this.pauseOffset = this.audioContext.currentTime - this.startedAt
    this.disposeSource()
    this.playing = false

    useAudioStore.getState().setIsPlaying(false)
    this.stopLoop()
  }

  stop(): void {
    this.disposeSource()
    this.pauseOffset = 0
    this.playing = false

    useAudioStore.getState().setIsPlaying(false)
    useAudioStore.getState().setCurrentTime(0)
    this.stopLoop()
  }

  
  resetLoadedTrack(): void {
    this.loadCounter += 1
    this.disposeSource()
    this.pauseOffset = 0
    this.playing = false
    this.buffer = null
    this.originalBytes = null

    const store = useAudioStore.getState()
    const cover = store.trackInfo.cover
    if (cover.startsWith('blob:')) URL.revokeObjectURL(cover)

    store.setIsPlaying(false)
    store.setCurrentTime(0)
    store.setTrackInfo({ title: '', artist: '', album: '', cover: '' })
    store.setLrcLines([])
    store.setSourceFileName(null)
    store.setSourceFileSize(null)
    store.setTrackPrepareBusy(false)
    store.setCatalogLabelsFromDiskCache(false)
    store.setSection('unknown')
    store.setCurrentLyric('')

    this.resetAnalysisState()
    this.stopLoop()
  }

  seek(time: number): void {
    if (!this.buffer) return
    const clamped = Math.max(0, Math.min(time, this.buffer.duration))

    if (this.playing) {
      this.disposeSource()

      this.source = this.audioContext.createBufferSource()
      this.source.buffer = this.buffer
      this.source.connect(this.gainNode)
      this.source.start(0, clamped)
      this.startedAt = this.audioContext.currentTime - clamped

      this.source.onended = () => {
        if (!this.playing) return
        const hook = this.onTrackEnd
        this.stop()
        if (hook) hook()
      }
    } else {
      this.pauseOffset = clamped
    }

    useAudioStore.getState().setCurrentTime(clamped)
  }

  getDuration(): number {
    return this.buffer?.duration ?? 0
  }

  getAudioBuffer(): AudioBuffer | null {
    return this.buffer
  }

  setVolume(value: number): void {
    this.gainNode.gain.setTargetAtTime(value, this.audioContext.currentTime, 0.01)
    useAudioStore.getState().setVolume(value)
  }

  tick(): void {
    const storeFirst = useAudioStore.getState()
    if (storeFirst.audioMode === 'system') {
      const { audioData, energy } = processSystemAudioFrame()
      const beat = this.beatDetector.detect(audioData)
      const elapsedSec = (performance.now() - this.systemModeStartTime) / 1000
      storeFirst.setAudioData(audioData)
      storeFirst.setEnergy(energy)
      storeFirst.setBeat(beat)
      storeFirst.setCurrentTime(elapsedSec)
      return
    }

    this.analyser.getFloatFrequencyData(this.dataArray)

    const normalized = new Float32Array(this.dataArray.length)
    let sum = 0
    for (let i = 0; i < this.dataArray.length; i++) {
      const v = Math.max(0, (this.dataArray[i] + 100) / 100)
      normalized[i] = v
      sum += v
    }

    const energy = sum / this.dataArray.length
    const beat = this.beatDetector.detect(normalized)

    const store = useAudioStore.getState()
    store.setAudioData(normalized)
    store.setEnergy(energy)
    store.setBeat(beat)

    if (this.playing) {
      store.setCurrentTime(this.audioContext.currentTime - this.startedAt)
    }
  }

  destroy(): void {
    this.stop()
    void this.audioContext.close()
  }
}

export const audioEngine = new AudioEngine()

export function shouldAutoPlayAfterPrepare(): boolean {
  const s = useAudioStore.getState()
  return s.trackInfo.title.trim().length > 0 && s.lrcLines.length > 0
}
