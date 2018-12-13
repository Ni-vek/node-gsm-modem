import debug = require('debug')
import SerialPort = require('serialport')
import {EventEmitter} from 'events'
import Options from './interfaces/Options'
import TaskOptions from './interfaces/TaskOptions'
import Sleep from './lib/Sleep'

class SmsModem extends EventEmitter {

    public smsStack: TaskOptions[]
    public serialPort: SerialPort
    private processingQueue: boolean
    private readonly debug: any
    private readonly port: string
    private readonly options: Options
    private readonly serialPortOptions: SerialPort.OpenOptions

    constructor(port: string, options?: {
        retry?: number,
        timeout?: number,
        dataBits?: number,
        stopBits?: number,
        baudRate?: number,
        parity?: string,
        autoOpen?: boolean,
        rtscts?: boolean,
        smsQueueWaitTime?: number
    }) {
        super()
        this.debug = debug('node-sms-modem')
        this.processingQueue = false
        this.port = port
        this.options = {
            retry: 0,
            smsQueueWaitTime: 5000,
            timeout: 15000
        }
        this.serialPortOptions = {
            autoOpen: true,
            baudRate: 9600,
            dataBits: 8,
            lock: true,
            parity: 'none',
            rtscts: true,
            stopBits: 1
        }
        if (!options) {
            options = {}
        }
        for (const key in options) {
            if (options.hasOwnProperty(key)) {
                this.options[key] = options[key]
                this.serialPortOptions[key] = options[key]
            }
        }
        this.serialPort = new SerialPort(this.port, this.serialPortOptions, () => {
            this.debug(`Serial port opened with options ${JSON.stringify(this.serialPortOptions)}`)
            this.emit('open')
            this.serialPort.on('error', (err) => {
                this.debug(`Serial port error ${err.message}`)
            })
            this.serialPort.on('data', (data: string) => {
                if (!this.processingQueue) {
                    this.debug(`Data from serial port ${data}`)
                    this.dispatchData(data)
                }
            })
            this.processQueue(this.getStack())
        })
        this.smsStack = []
    }

    // Real life commands
    public async sendSms(smsInfo: { receiver: string, text: string, mode?: number }) {
        return Promise.all([
            this.reset(),
            this.setSmsMode(smsInfo.mode || 1),
            this.setReceiver(smsInfo.receiver),
            this.setTextMessage(smsInfo.text)
        ])
    }

    public async id() {
        return this.createTask('ATI', {expectedReturn: /OK/})
    }

    public async imsi() {
        return this.createTask('AT+CIMI', {expectedReturn: /OK/})
    }

    public async model() {
        return this.createTask('AT+CGMM', {expectedReturn: /OK/})
    }

    public async version() {
        // AT+CGMR
        return this.createTask('AT+CGMR', {expectedReturn: /OK/})
    }

    public async manufacturer() {
        // AT+CGMI
        return this.createTask('AT+CGMI', {expectedReturn: /OK/})
    }

    public async clock() {
        return this.createTask('AT+CCLK?', {expectedReturn: /OK/})
    }

    public async signalStrength() {
        return this.createTask('AT+CSQ', {
            expectedReturn: /\+CSQ:/,
            postProcessFunction: (data: string[]) => {
                const result: { ber: string, rssi: string } = {
                    ber: '',
                    rssi: ''
                }
                for (const line of data) {
                    if (line) {
                        let res: RegExpMatchArray | null = line.match(/\+CSQ:\s*(.+)/)
                        if (res) {
                            res = res[1].split(',')
                            result.ber = res[1]
                            result.rssi = res[0]
                        }
                    }
                }
                return result
            }
        })
        // return this.test('CSQ').then(() => {
        // this.get('CSQ').then(res => {
        //   return res.match(/\+CSQ:\s(.+)/)[1]
        // })
        // return this.exec('CSQ')
        //     .then(res => {
        //     res = res.match(/\+CSQ:\s*(.+)/)
        //     res = res[1].split(',')
        //     return {
        //         rssi: res[0],
        //         ber: res[1]
        //     }
        // })
        // })
    }

    public async smsCenter() {
        return this.createTask('AT+CSCA?', {expectedReturn: /OK/})
    }

    public async smsList() {
        return this.createTask('AT+CMGL', {expectedReturn: /OK/})
    }

    public async readSms(index: number): Promise<{}> {
        return this.createTask(`AT+CMGR=${index}`, {
            expectedReturn: /\+CMGR:/,
            postProcessFunction: (data: string) => {
                const result: { date: string, sender: string, text: string, time: string } = {
                    date: '',
                    sender: '',
                    text: '',
                    time: ''
                }
                for (const line of data) {
                    if (line) {
                        if (/\+CMGR:/.test(line)) {
                            const sections = line.trim().replace(/"/g, '').split(',')
                            if (sections.length >= 5) {
                                result.sender = sections[1]
                                result.date = sections[3]
                                result.time = sections[4]
                            }
                        } else {
                            result.text = line
                        }
                    }
                }
                this.emit('sms received', result)
                return result
            }
        })
    }

    public async deleteSms(index: number) {
        return this.createTask(`AT+CMGD=${index}`, {expectedReturn: /OK/})
    }

    public async setSmsReceivedListener() {
        return this.createTask(`AT+CNMI=2,1,0,2,0`, {expectedReturn: /OK/})
    }

    public async dial(phone: number) {
        return this.createTask(`AT+ATD${phone}`)
    }

    public async hangup() {
        return this.createTask('AT+ATH')
    }

    private async setReceiver(receiver: string) {
        return this.createTask(`AT+CMGS="${receiver}"`, {expectedReturn: />/})
    }

    private async setTextMessage(text: string) {
        return this.createTask(text + '\u001a', {expectedReturn: /\+CMGS/})
    }

    private async reset() {
        return this.createTask('ATZ', {expectedReturn: /OK/})
    }

    private async setSmsMode(mode: number) {
        return this.createTask(`AT+CMGF=${mode}`, {expectedReturn: /OK/})
    }

    private* getStack(): IterableIterator<TaskOptions | null> {
        while (true) {
            let nextTask = null
            if (this.smsStack.length) {
                nextTask = this.smsStack[0]
            }
            yield nextTask
        }
    }

    private launchNextTask(iterator: IterableIterator<TaskOptions | null>, time: number) {
        this.debug(`Waiting ${time}ms before launching next request`)
        Sleep.create(time).then(() => {
            this.processQueue(iterator)
        })
    }

    private processQueue(iterator: IterableIterator<TaskOptions | null>) {
        const nextTask = iterator.next().value
        const self = this
        if (nextTask) {
            this.processingQueue = true
            this.serialPort.on('data', parseResponse)
            this.debug(`Writing to serial port ${nextTask.task}`)
            this.serialPort.write(nextTask.task + '\r', (writeErr: string) => {
                if (writeErr) {
                    this.debug(`Serial port write error ${writeErr}`)
                    if (nextTask.reject) {
                        nextTask.reject(writeErr)
                    }
                    this.launchNextTask(iterator, 100)
                } else {
                    this.debug(`Task ${nextTask.task} written`)
                    this.serialPort.drain((drainErr: { message: string }) => {
                        if (drainErr) {
                            this.debug(`Serial port drain error ${drainErr.message}`)
                            if (nextTask.reject) {
                                nextTask.reject(drainErr.message)
                            }
                            this.launchNextTask(iterator, 100)
                        }
                    })
                }
            })
        } else {
            this.processingQueue = false
            //     this.debug(`No task to do. Waiting for ${this.options.smsQueueWaitTime}ms`)
            //     this.launchNextTask(iterator, this.options.smsQueueWaitTime)
        }

        function parseResponse(data: string) {
            self.debug(`Parsing response ${data}`)
            const buffer = Buffer.from(data).toString()
            if (buffer) {
                if (nextTask) {
                    if (/ERROR/.test(buffer) || !nextTask.options.expectedReturn.test(buffer)) {
                        self.rejectTask(nextTask, buffer, iterator)
                    } else {
                        if (nextTask.options.postProcessFunction) {
                            self.acceptTask(
                                nextTask,
                                nextTask.options.postProcessFunction(buffer.split('\r\n')),
                                iterator
                            )
                        } else {
                            self.acceptTask(nextTask, buffer, iterator)
                        }
                    }
                }
                self.serialPort.removeListener('data', parseResponse)
            }
        }
    }

    private acceptTask(task: TaskOptions, parsed: string, iterator: IterableIterator<TaskOptions | null>) {
        if (task.accept) {
            task.accept(parsed)
            this.launchNextTask(iterator, 100)
        } else {
            throw new Error(`Cannot accept task ${task.task}`)
        }
    }

    private rejectTask(task: TaskOptions, parsed: string, iterator: IterableIterator<TaskOptions | null>) {
        if (task.reject) {
            task.reject(`data expected does not match real data received - ${parsed}`)
            this.launchNextTask(iterator, 100)
        } else {
            throw new Error(`Cannot reject task ${task.task}`)
        }
    }

    private parseResponse(data: string) {
        this.debug(`Parsing data ${data}`)
        const plain = data.slice(data.indexOf(':') + 1).trim()
        const parts = plain.split(/,(?=(?:[^"]|"[^"]*")*$)/)

        for (const part of parts) {
            part.replace(/"/g, '')
        }
        return parts
    }

    private dispatchData(data: string) {
        const buffer = Buffer.from(data).toString()
        if (buffer) {
            const split = buffer.split('\r\n')
            for (const parsed of split) {
                // New SMS
                if (/\+CMTI/.test(parsed)) {
                    console.log(parsed)
                    const messageInfo = this.parseResponse(parsed)
                    console.log(messageInfo)
                    this.readSms(parseInt(messageInfo[1], 10)).then((message: any) => {
                        console.log(message)
                        this.sendSms({
                            receiver: message.sender,
                            text: '73 rules!!! <3'
                        })
                    })
                    // const memory = messageInfo[0]
                    // this.set('CPMS', memory)
                    //   .then((memory_usage) => {
                    //     memory_usage = this.parseResponse(memory_usage)
                    //     const used = parseInt(memory_usage[0])
                    //     const total = parseInt(memory_usage[1])
                    //
                    //     if (used === total) this.emit('memory full', memory)
                    //   })
                    //
                    // this.set('CMGR', messageInfo[1])
                    //     .then((cmgr) => {
                    //         const lines = cmgr.trim()
                    //             .split('\n')
                    //
                    //         console.log(lines)
                    //         // const message = this.processReceivedPdu(lines[1], message_info[1])
                    //         // if(message)
                    //         // this.emit('sms received', message)
                    //     })
                }
            }
        }
    }

    private async createTask(task: string, options?: {}): Promise<{}> {
        if (!options) {
            options = {}
        }
        const taskOptions: any = {
            finished: false,
            options: Object.assign({}, options),
            task
        }
        taskOptions.promise = new Promise((resolve, reject) => {
            taskOptions.accept = (message?: {}) => {
                this.smsStack.splice(0, 1)
                if (taskOptions.finished) {
                    throw new Error('Already called')
                } else {
                    taskOptions.finished = true
                    resolve(message)
                }
            }
            taskOptions.reject = (message: any) => {
                this.smsStack.splice(0, 1)
                if (taskOptions.finished) {
                    throw new Error('Already called')
                } else {
                    taskOptions.finished = true
                    reject(message)
                }
            }
        })
        this.smsStack.push(taskOptions)
        this.debug(`Task ${task} created`)
        if (!this.processingQueue) {
            this.processingQueue = true
            this.launchNextTask(this.getStack(), 100)
        }
        return taskOptions.promise
    }
}

export = {SmsModem}
