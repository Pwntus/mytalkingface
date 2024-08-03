<template lang="pug">
#uploader.mx-auto.mb-8.px-4.max-w-5xl.grid.grid-cols-1.gap-8(
  v-if="api_token"
  class="sm:mb-16 md:mb-24 sm:px-6 lg:px-8 sm:gap-y-24 md:grid-cols-2"
)
  //- Hidden input
  input(
    @change="onFileSelected"
    type="file"
    ref="file"
    accept="video/*"
  )

  div
    .upload-button.relative.overflow-hidden.w-full.flex.flex-col.gap-4.justify-center.items-center.text-center.cursor-pointer.rounded-2xl.aspect-1.text-2xl(
      @click="onClickUpload"
      class="bg-[#e4e4e4] hover:bg-[#dddddd]"
    )
      template(v-if="video_original")
        .preview
          video.w-full.h-full.bg-black(controls)
            source(
              :src="video_original"
            )
      template(v-else)
        template(v-if="loading_file")
          u-progress(animation="swing")
        template(v-else)
          u-icon.icon(
            name="i-heroicons-arrow-up-tray"
          )
          span Upload a video
          span.text-sm of yourself talking
    .text-center.my-4(v-if="video_original")
      u-button(
        @click="reset"
        icon="i-heroicons-trash"
        variant="link"
        color="black"
      )
  div.space-y-4
    u-formGroup(
      label="Target language"
      name="language"
      size="xl"
    )
      u-select(
        v-model="language"
        :options="language_options"
        icon="i-heroicons-language"
        option-attribute="label"
        size="xl"
      )
    u-formGroup(
      label="Watch the progress"
      size="xl"
    )
      u-accordion(
        v-if="show_accordion"
        :items="accordion_items"
      )
        template(#item="{ item }")
          u-button.mr-1(
            v-if="item.statusBadge"
            :label="item.statusBadge.text"
            :color="item.statusBadge.color"
            variant="solid"
            size="2xs"
            :loading="item.statusBadge.text === 'starting' || item.statusBadge.text === 'processing'"
          )
          | {{ item.content }}

    u-button(
      v-if="video_retalk"
      :to="video_retalk"
      target="_blank"
      size="xl"
      color="primary"
      block
    ) Open final video
</template>

<script>
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg'
import { useLocalStorage } from '@vueuse/core'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const ffmpeg = createFFmpeg({ log: true })

export default {
  name: 'Uploader',
  setup: () => ({
    api_token: useLocalStorage('mytalkingface-api-token', null),
    language: useLocalStorage('mytalkingface-language', 'en')
  }),
  data: () => ({
    show_accordion: true,
    abort: false,
    status: null,

    loading_file: false,
    loading_transcribe: false,
    loading_translate: false,
    loading_tts: false,
    loading_retalk: false,

    audio_original: null,
    video_original: null,
    transcription_original: null,
    transcription_translated: null,
    audio_tts: null,
    video_retalk: null,

    language_options: [
      { label: 'English', value: 'en' },
      { label: 'Spanish', value: 'es' },
      { label: 'French', value: 'fr' },
      { label: 'German', value: 'de' },
      { label: 'Italian', value: 'it' },
      { label: 'Portugese', value: 'pt' },
      { label: 'Polish', value: 'pl' },
      { label: 'Turkish', value: 'tr' },
      { label: 'Russian', value: 'ru' },
      { label: 'Netherlands', value: 'nl' },
      { label: 'Arabic', value: 'ar' },
      { label: 'Chinese', value: 'zh' },
      { label: 'Korean', value: 'ko' },
      { label: 'Hindi', value: 'hi' }
    ]
  }),
  computed: {
    accordion_items() {
      return [
        {
          label: '1. Upload',
          icon: 'i-heroicons-arrow-up-tray',
          content:
            'The audio is separated from the video and uploaded to a temporary cloud storage. Uploaded files are faster for machine learning models to process.',
          variant: this.loading_file ? 'solid' : 'ghost',
          defaultOpen: this.loading_file
        },
        {
          label: '2. Transcribe',
          icon: 'i-heroicons-microphone',
          content: `The audio is transcribed to a text string so that it can be translated. Transcribed text: ${
            this.transcription_original || 'loading...'
          }`,
          variant: this.loading_transcribe ? 'solid' : 'ghost',
          defaultOpen: this.loading_transcribe,
          statusBadge: this.loading_transcribe ? this.status_badge : null
        },
        {
          label: '3. Translate',
          icon: 'i-heroicons-language',
          content: `The text is translated by a language model into a target language (${
            this.language
          }). Translated text: ${
            this.transcription_translated || 'loading...'
          }`,
          variant: this.loading_translate ? 'solid' : 'ghost',
          defaultOpen: this.loading_translate,
          statusBadge: this.loading_translate ? this.status_badge : null
        },
        {
          label: '4. TTS',
          icon: 'i-heroicons-speaker-wave',
          content:
            'The translated text and audio recording is used by a text-to-speech model to synthesize a new audio recording with the original voice.',
          variant: this.loading_tts ? 'solid' : 'ghost',
          defaultOpen: this.loading_tts,
          statusBadge: this.loading_tts ? this.status_badge : null
        },
        {
          label: '5. Lipsync',
          icon: 'i-heroicons-face-smile',
          content: `The original video and the new audio is used by a lip-synching model to create a new video. This can take a while (>5min).`,
          variant: this.loading_retalk ? 'solid' : 'ghost',
          defaultOpen: this.loading_retalk,
          statusBadge: this.loading_retalk ? this.status_badge : null
        }
      ]
    },
    status_badge() {
      const color_map = {
        starting: 'black',
        processing: 'blue',
        succeeded: 'green',
        failed: 'red',
        canceled: 'yellow'
      }

      const color = Object.keys(color_map).includes(this.status)
        ? color_map[this.status]
        : 'gray'

      return {
        color,
        text: this.status
      }
    }
  },
  watch: {
    accordion_items() {
      this.show_accordion = false
      this.$nextTick(() => (this.show_accordion = true))
    }
  },
  methods: {
    reset() {
      this.abort = true
      this.status = null

      this.loading_file = false
      this.loading_transcribe = false
      this.loading_translate = false
      this.loading_tts = false
      this.loading_retalk = false

      this.audio_original = null
      this.video_original = null
      this.transcription_original = null
      this.transcription_translated = null
      this.audio_tts = null
      this.video_retalk = null
    },
    onClickUpload() {
      if (!this.api_token || this.loading_file || this.video_original) return
      this.$refs.file.click()
    },
    async onFileSelected(e) {
      this.audio_original = null
      this.video_original = null

      this.loading_file = true

      try {
        this.abort = false
        const file = e.target.files[0]

        if (!ffmpeg.isLoaded()) {
          await ffmpeg.load()
        }

        // Write the file to FFmpeg's file system
        ffmpeg.FS('writeFile', 'input_video', await fetchFile(file))

        // Convert the input video to MP4 with max 480x480 size
        await ffmpeg.run(
          '-i',
          'input_video',
          '-c:v',
          'libx264', // Use H.264 codec for video
          '-c:a',
          'aac', // Use AAC codec for audio
          '-strict',
          'experimental', // Needed for some FFmpeg versions
          '-b:a',
          '192k', // Audio bitrate
          '-vf',
          'scale=w=480:h=480:force_original_aspect_ratio=decrease,pad=480:480:(ow-iw)/2:(oh-ih)/2,setsar=1:1', // Scale and pad to 480x480
          '-pix_fmt',
          'yuv420p', // Ensure video compatibility
          'output.mp4'
        )

        // Read the converted MP4 file
        const mp4Data = ffmpeg.FS('readFile', 'output.mp4')

        // Create a Blob from the MP4 data
        const mp4Blob = new Blob([mp4Data.buffer], { type: 'video/mp4' })

        // Convert MP4 to base64
        const videoBase64Promise = new Promise((resolve) => {
          const videoReader = new FileReader()
          videoReader.onload = () => {
            resolve(videoReader.result)
          }
          videoReader.readAsDataURL(mp4Blob)
        })

        // Extract audio from the MP4
        await ffmpeg.run(
          '-i',
          'output.mp4',
          '-vn',
          '-acodec',
          'libmp3lame',
          'output.mp3'
        )

        // Read the result
        const data = ffmpeg.FS('readFile', 'output.mp3')

        // Create a Blob from the data
        const audioBlob = new Blob([data.buffer], { type: 'audio/mp3' })

        // Convert audio to base64
        const audioBase64Promise = new Promise((resolve) => {
          const audioReader = new FileReader()
          audioReader.onload = () => {
            resolve(audioReader.result)
          }
          audioReader.readAsDataURL(audioBlob)
        })

        // Wait for both video and audio processing to complete
        const [videoBase64, audioBase64] = await Promise.all([
          videoBase64Promise,
          audioBase64Promise
        ])

        // Wait for both video and audio upload to complete
        const [video_original_file, audio_original_file] = await Promise.all([
          videoBase64, // this.createFile('video_original.mp4', videoBase64),
          this.createFile('audio_original.mp3', audioBase64)
        ])

        this.video_original = video_original_file
        this.audio_original = audio_original_file

        this.loading_file = false

        // Start pipeline
        this.pipeline()
      } catch (e) {
        console.log(e)
      } finally {
        // Clean up FFmpeg file system
        try {
          ffmpeg.FS('unlink', 'input_video')
          ffmpeg.FS('unlink', 'output.mp4')
          ffmpeg.FS('unlink', 'output.mp3')
        } catch (e) {
          console.error('Error cleaning up FFmpeg file system:', e)
        }
      }
    },

    // ---

    async createFile(file_name, data) {
      try {
        const response = await $fetch('/api/file', {
          method: 'POST',
          body: {
            api_token: this.api_token,
            file_name,
            data
          }
        })

        return response.data
      } catch (e) {
        console.log('--- error (createFile):', e.message)
      }
    },
    async createPrediction(version, input, poll_interval = 4000) {
      try {
        this.status = 'starting'

        const response = await $fetch('/api/prediction', {
          method: 'POST',
          body: {
            api_token: this.api_token,
            version,
            input
          }
        })

        const id = response.data.id

        let response_poll = null

        // Poll
        while (this.status !== 'succeeded' && this.status !== 'failed') {
          response_poll = await $fetch(
            `/api/prediction?api_token=${this.api_token}&id=${id}`
          )
          this.status = response_poll.data.status

          if (this.status !== 'succeeded' && this.status !== 'failed') {
            await sleep(poll_interval)
          } else {
            await sleep(1000)
          }
        }

        return response_poll.data
      } catch (e) {
        console.log('--- error (createPrediction):', e.message)
      }
    },

    // ---

    async pipeline() {
      try {
        if (this.abort) {
          this.reset()
          return
        }

        // Transcribe
        this.loading_transcribe = true
        const transcription_prediction = await this.createPrediction(
          '3ab86df6c8f54c11309d4d1f930ac292bad43ace52d10c80d87eb258b3c9f79c',
          {
            audio: this.audio_original,
            batch_size: 64
          }
        )
        this.transcription_original = transcription_prediction.output.text
        this.loading_transcribe = false

        if (this.abort) {
          this.reset()
          return
        }

        // Translate
        this.loading_translate = true
        const language_option = this.language_options.find(
          ({ value }) => value === this.language
        )
        const translation_prediction = await this.createPrediction(
          'meta/meta-llama-3-8b-instruct',
          {
            prompt: `Translate the text into ${language_option.label}. Do not add anything other than the translated text!\n\nText: ${this.transcription_original}`
          },
          1000
        )
        this.transcription_translated = translation_prediction.output.join('')
        this.loading_translate = false

        if (this.abort) {
          this.reset()
          return
        }

        // TTS
        this.loading_tts = true
        const tts_prediction = await this.createPrediction(
          '684bc3855b37866c0c65add2ff39c78f3dea3f4ff103a436465326e0f438d55e',
          {
            text: this.transcription_translated,
            speaker: this.audio_original,
            language: this.language,
            cleanup_voice: true
          },
          5000
        )
        this.audio_tts = tts_prediction.output
        this.loading_tts = false

        if (this.abort) {
          this.reset()
          return
        }

        // Video retalk
        this.loading_retalk = true
        const retalk_prediction = await this.createPrediction(
          'db5a650c807b007dc5f9e5abe27c53e1b62880d1f94d218d27ce7fa802711d67',
          {
            face: this.video_original,
            input_audio: this.audio_tts
          },
          10000
        )
        this.video_retalk = retalk_prediction.output
        this.loading_retalk = false

        if (this.abort) {
          this.reset()
          return
        }
      } catch (e) {
        console.log('--- error (pipeline):', e.message)
      }
    }
  }
}
</script>

<style lang="stylus" scoped>
#uploader
  input[type="file"]
    display none

  .upload-button
    transition background 150ms ease-in-out

    .preview
      background-size cover
      background-position center
      position absolute
      bottom 0
      right 0
      left 0
      top 0

    .icon
      transition transform 150ms ease-in-out

    &:hover
      .icon
        transform translateY(-5px)
</style>
