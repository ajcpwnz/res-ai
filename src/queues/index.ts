import PQueue from 'p-queue'

export const jobQueue = new PQueue({ concurrency: 1 })
