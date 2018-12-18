import debug = require('debug')
import {EventEmitter} from 'events'
import pdu = require('pdu')
import SerialPort = require('serialport')
import Options from './interfaces/Options'
import TaskOptions from './interfaces/TaskOptions'
import {GsmErrors} from './lib/GsmErrors'
import Sleep from './lib/Sleep'

type MixedOptions = Options & SerialPort.OpenOptions

export default class SmsModem extends EventEmitter {

    public smsStack: TaskOptions[]
    public serialPort: SerialPort
    private processingQueue: boolean
    private readonly SerialPortLib: any
    private readonly debug: any
    private readonly port: string
    private readonly options: Options
    private readonly serialPortOptions: SerialPort.OpenOptions

    constructor(port: string, options?: MixedOptions, customSerialPort?: any) {
        super()
        this.debug = debug('node-sms-modem')
        this.processingQueue = false
        this.port = port
        this.options = {
            removeDeviceEcho: false,
            retry: 0,
            smsQueueWaitTime: 100,
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
        if (customSerialPort) {
            this.SerialPortLib = customSerialPort
        } else {
            this.SerialPortLib = SerialPort
        }
        for (const key in options) {
            if (options.hasOwnProperty(key)) {
                this.options[key] = options[key]
                this.serialPortOptions[key] = options[key]
            }
        }
        this.serialPort = new this.SerialPortLib(this.port, this.serialPortOptions, (err: any) => {
            if (err) {
                this.debug(`Serial port open error ${err.message}`)
                this.emit('error', err)
            } else {
                this.debug(`Serial port opened with options ${JSON.stringify(this.serialPortOptions)}`)
                this.emit('open')
                if (this.options.pinCode) {
                    this.setPinCode(this.options.pinCode).then(() => {
                        this.debug('Pin code OK')
                        this.emit('pin ok')
                    })
                }
                this.serialPort.on('error', (error) => {
                    this.debug(`Serial port error ${error.message}`)
                    this.emit('error', err)
                })
                this.serialPort.on('data', (data: string) => {
                    this.dispatchData(data)
                })
                this.on('task_created', () => {
                    if (!this.processingQueue) {
                        this.processingQueue = true
                        this.processQueue(this.getStack())
                    }
                })
            }
        })
        this.smsStack = []
    }

    // Real life commands
    public async sendSms(smsInfo: { receiver: string, text: string, mode?: number }) {
        return Promise.all([
            this.setSmsMode(smsInfo.mode || 1),
            this.setReceiver(smsInfo.receiver),
            this.setTextMessage(smsInfo.text)
        ])
    }

    public async activateErrorsCodes(customReturn?: RegExp) {
        return this.createTask(`AT+CMEE=1`, {expectedReturn: customReturn || /OK/})
    }

    public activateStatusReport(customReturn?: RegExp) {
        return this.createTask(`AT+CSMP=33,,0,0`, {expectedReturn: customReturn || /OK/})
    }

    public async customCommand(cmd: string, options: {
        expectedReturn: RegExp,
        postProcessFunction?: (data: string[]) => any
    }) {
        return this.createTask(cmd, options)
    }

    public async setPinCode(pin: string | number, customReturn?: RegExp) {
        return this.createTask(`AT+CPIN=${pin}`, {expectedReturn: customReturn || /OK/})
    }

    public async checkPinCode() {
        return this.createTask(`AT+CPIN?`, {
            expectedReturn: /\+CPIN:/,
            postProcessFunction: (dataParsed: string[]) => {
                return new Promise((resolve, reject) => {
                    const result: { data: string[] | {}, message?: string } = {
                        data: dataParsed,
                        message: undefined
                    }
                    for (const line of dataParsed) {
                        if (line) {
                            if (/READY/.test(line)) {
                                resolve(result)
                            } else if (/PIN/.test(line)) {
                                result.message = 'Wrong PIN provided'
                                reject(result)
                            } else if (/PUK/.test(line)) {
                                result.message = 'PUK code wanted'
                                reject(result)
                            }
                        }
                    }
                })
            }
        })
    }

    public async unlockSimPin(pin: string | number, customReturn?: RegExp) {
        return this.createTask(`AT+CLCK="SC",0,${pin}`, {expectedReturn: customReturn || /OK/})
    }

    public async lockSimPin(pin: string | number, customReturn?: RegExp) {
        return this.createTask(`AT+CLCK="SC",1,${pin}`, {expectedReturn: customReturn || /OK/})
    }

    // You should run a setPinCode command after
    public async changePin(oldPin: string | number, newPin: string | number, customReturn?: RegExp) {
        return this.createTask(`AT+CPWD="SC",${oldPin},${newPin}`, {expectedReturn: customReturn || /OK/})
    }

    public async checkGsmNetwork() {
        return this.createTask(`AT+CREG?`, {
            expectedReturn: /\+CREG:/,
            postProcessFunction: async (dataParsed: string[]) => {
                return new Promise((resolve, reject) => {
                    const result: { data: string[] | {}, message?: string } = {
                        data: dataParsed,
                        message: undefined
                    }
                    for (const line of dataParsed) {
                        if (line) {
                            if (/0,[15]/.test(line)) {
                                resolve(result)
                            } else {
                                result.message = 'Searching for network'
                                reject(result)
                            }
                        }
                    }
                })
            }
        })
    }

    public async id(customReturn?: RegExp) {
        return this.createTask('ATI', {expectedReturn: customReturn || /.+/})
    }

    public async imsi(customReturn?: RegExp) {
        return this.createTask('AT+CIMI', {expectedReturn: customReturn || /[0-9]+/})
    }

    public async model(customReturn?: RegExp) {
        return this.createTask('AT+CGMM', {expectedReturn: customReturn || /.+/})
    }

    public async version(customReturn?: RegExp) {
        return this.createTask('AT+CGMR', {expectedReturn: customReturn || /.+/})
    }

    public async manufacturer(customReturn?: RegExp) {
        return this.createTask('AT+CGMI', {expectedReturn: customReturn || /.+/})
    }

    public async clock() {
        return this.createTask('AT+CCLK?', {
            expectedReturn: /\+CCLK:/,
            postProcessFunction: (dataParsed: string[]) => {
                return new Promise((resolve, reject) => {
                    const result: { data: string[] | {}, message?: string, transformedData: { date?: string, time?: string } } = {
                        data: dataParsed,
                        message: undefined,
                        transformedData: {
                            date: undefined,
                            time: undefined
                        }
                    }
                    for (const line of dataParsed) {
                        if (line) {
                            let res: RegExpMatchArray | null = line.match(/\+CCLK:\s*(.+)/)
                            if (res) {
                                res = res[1].trim().replace(/"/g, '').split(',')
                                result.transformedData.date = res[0]
                                result.transformedData.time = res[1]
                                resolve(result)
                            }
                        }
                    }
                })
            }
        })
    }

    public async signalStrength() {
        return this.createTask('AT+CSQ', {
            expectedReturn: /\+CSQ:/,
            postProcessFunction: (dataParsed: string[]) => {
                return new Promise((resolve, reject) => {
                    const result: { data: string[] | {}, message?: string, transformedData: { ber?: string, rssi?: string } } = {
                        data: dataParsed,
                        message: undefined,
                        transformedData: {
                            ber: undefined,
                            rssi: undefined
                        }
                    }
                    for (const line of dataParsed) {
                        if (line) {
                            let res: RegExpMatchArray | null = line.match(/\+CSQ:\s*(.+)/)
                            if (res) {
                                res = res[1].trim().replace(/"/g, '').split(',')
                                result.transformedData.ber = res[1]
                                result.transformedData.rssi = res[0]
                                resolve(result)
                            }
                        }
                    }
                })
            }
        })
    }

    public async smsCenter() {
        return this.createTask('AT+CSCA?', {
            expectedReturn: /\+CSCA/,
            postProcessFunction: (dataParsed: string[]) => {
                return new Promise((resolve, reject) => {
                    const result: { data: string[] | {}, message?: string, transformedData: { number?: string } } = {
                        data: dataParsed,
                        message: undefined,
                        transformedData: {
                            number: undefined
                        }
                    }
                    for (const line of dataParsed) {
                        if (line) {
                            const res: RegExpMatchArray | null = line.match(/\+CSCA:\s*(.+),/)
                            if (res) {
                                result.transformedData.number = res[1].trim().replace(/"/g, '').toString()
                                resolve(result)
                            }
                        }
                    }
                })
            }
        })
    }

    // TODO wait for serial port to send OK after the SMS list
    public async smsList() {
        return this.createTask('AT+CMGL="ALL"', {
            expectedReturn: /OK/,
            postProcessFunction: (dataParsed: string[]) => {
                return new Promise((resolve, reject) => {
                    const result: { data: string[] | {}, message?: string, transformedData: { messages: object[] } } = {
                        data: dataParsed,
                        message: undefined,
                        transformedData: {
                            messages: []
                        }
                    }
                    let newMessage: { date: string, id: string, sender: string, text: string, time: string } = {
                        date: '',
                        id: '',
                        sender: '',
                        text: '',
                        time: ''
                    }
                    for (const line of dataParsed) {
                        if (line) {
                            if (/\+CMGL:/.test(line)) {
                                newMessage = {
                                    date: '',
                                    id: '',
                                    sender: '',
                                    text: '',
                                    time: ''
                                }
                                const sections = line.trim().replace(/"/g, '').split(',')
                                if (sections.length >= 5) {
                                    newMessage.id = sections[0]
                                    newMessage.sender = sections[2]
                                    newMessage.date = sections[3]
                                    newMessage.time = sections[4]
                                }
                            } else {
                                try {
                                    newMessage.text = pdu.parse(line)
                                } catch (e) {
                                    newMessage.text = line
                                }
                                result.transformedData.messages.push(newMessage)
                            }
                        }
                    }
                    resolve(result)
                })
            }
        })
    }

    public async readSms(index: number): Promise<{}> {
        return this.createTask(`AT+CMGR=${index}`, {
            expectedReturn: /\+CMGR:/,
            postProcessFunction: (dataParsed: string[]) => {
                return new Promise((resolve, reject) => {
                    const result: { data: string[] | {}, message?: string, transformedData: { date?: string, sender?: string, text?: string, time?: string } } = {
                        data: dataParsed,
                        message: undefined,
                        transformedData: {
                            date: undefined,
                            sender: undefined,
                            text: undefined,
                            time: undefined
                        }
                    }
                    for (const line of dataParsed) {
                        if (line) {
                            if (/\+CMGR:/.test(line)) {
                                const sections = line.trim().replace(/"/g, '').split(',')
                                if (sections.length >= 5) {
                                    result.transformedData.sender = sections[1]
                                    result.transformedData.date = sections[3]
                                    result.transformedData.time = sections[4]
                                }
                            } else {
                                try {
                                    result.transformedData.text = pdu.parse(line)
                                } catch (e) {
                                    result.transformedData.text = line
                                }
                            }
                        }
                    }
                    resolve(result)
                })
            }
        })
    }

    public async saveConfiguration(customReturn?: RegExp) {
        return this.createTask('AT&W', {expectedReturn: customReturn || /OK/})
    }

    public async currentConfiguration(customReturn?: RegExp) {
        return this.createTask('AT&V', {expectedReturn: customReturn || /ACTIVE PROFILE/})
    }

    public async deleteSms(index: number, customReturn?: RegExp) {
        return this.createTask(`AT+CMGD=${index}`, {expectedReturn: customReturn || /OK/})
    }

    public async deleteAllSms(customReturn?: RegExp) {
        return this.createTask(`AT+CMGD=1,4`, {expectedReturn: customReturn || /OK/})
    }

    public async setSmsReceivedListener(customReturn?: RegExp) {
        return this.createTask(`AT+CNMI=2,1,0,2,0`, {expectedReturn: customReturn || /OK/})
    }

    public async setReceiver(receiver: string, customReturn?: RegExp) {
        return this.createTask(`AT+CMGS="${receiver}"`, {expectedReturn: customReturn || />/})
    }

    public async setTextMessage(text: string, customReturn?: RegExp) {
        return this.createTask(text + '\u001a', {expectedReturn: customReturn || /\+CMGS/})
    }

    public async resetModem(customReturn?: RegExp) {
        return this.createTask('ATZ', {expectedReturn: customReturn || /OK/})
    }

    public async setSmsMode(mode: number, customReturn?: RegExp) {
        return this.createTask(`AT+CMGF=${mode}`, {expectedReturn: customReturn || /OK/})
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
            // this.serialPort.on('readable', waitingForReadable)
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
            // this.debug(`No task to do. Waiting for ${this.options.smsQueueWaitTime}ms`)
            // this.launchNextTask(iterator, this.options.smsQueueWaitTime || 500)
        }

        // function waitingForReadable() {
        //     console.log('Readable event received')
        //     if (nextTask) {
        //         nextTask.canBeFinished = true
        //     }
        // }

        function parseResponse(data: string) {
            const buffer = Buffer.from(data).toString()
            if (buffer && nextTask && (!self.options.removeDeviceEcho || (self.options.removeDeviceEcho && buffer !== nextTask.task))) {
                const parsedBuffer: string[] = buffer.trim().split('\r\n')
                self.debug(`Parsing response for command ${nextTask.task} - ${data}`)
                if (/ERROR/.test(buffer) || !nextTask.options.expectedReturn.test(buffer)) {
                    self.rejectTask(nextTask, parsedBuffer, iterator)
                } else {
                    if (nextTask.options.postProcessFunction) {
                        nextTask.options.postProcessFunction(parsedBuffer).then((results: { data: string[] | {}, transformedData?: {} }) => {
                            self.acceptTask(
                                nextTask,
                                results.data,
                                iterator,
                                results.transformedData
                            )
                        }).catch((err: { data: string[] | {}, message?: string }) => {
                            self.rejectTask(nextTask, err.data, iterator, err.message)
                        })
                    } else {
                        self.acceptTask(nextTask, parsedBuffer, iterator)
                    }
                }
                self.serialPort.removeListener('data', parseResponse)
            }
        }
    }

    private acceptTask(task: TaskOptions, parsed: string[] | {}, iterator: IterableIterator<TaskOptions | null>, transformedData?: {}) {
        if (task.accept) {
            task.accept({
                data: parsed,
                transformedData
            })
            this.launchNextTask(iterator, 100)
        } else {
            throw new Error(`Cannot accept task ${task.task}`)
        }
    }

    private rejectTask(task: TaskOptions, parsed: string[] | {}, iterator: IterableIterator<TaskOptions | null>, message?: string) {
        if (task.reject) {
            const rejectObject: { code: number | string | undefined, data: string[] | {}, err: string } = {
                code: undefined,
                data: parsed,
                err: message || `Expected data ${task.options.expectedReturn}, does not match real data received ${parsed}, for command ${task.task}`
            }
            for (const stringParsed in parsed) {
                if (parsed.hasOwnProperty(stringParsed)) {
                    const elements = /\+(CME|CMS).+: ([0-9]+)/.exec(parsed[stringParsed])
                    if (elements && elements.length) {
                        rejectObject.code = elements[2]
                        rejectObject.err = GsmErrors[elements[1]][elements[2]]
                    }
                }
            }
            task.reject(rejectObject)
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
        this.debug(`Data from serial port ${data}`)
        const buffer = Buffer.from(data).toString()
        if (buffer) {
            const split = buffer.split('\r\n')
            for (const parsed of split) {
                // New SMS
                if (/\+CMTI/.test(parsed)) {
                    const messageInfo = this.parseResponse(parsed)
                    this.readSms(parseInt(messageInfo[1], 10)).then((message: any) => {
                        this.emit('new_sms', message)
                    })
                } else {
                    this.emit('something_received', split)
                }
            }
        }
    }

    private async createTask(task: string, options?: {}): Promise<{ code?: number | string | undefined, data: string[] | {}, err?: string, transformedData: {} }> {
        if (!options) {
            options = {}
        }
        const taskOptions: any = {
            finished: false,
            options: Object.assign({}, options),
            task
        }
        taskOptions.promise = new Promise((resolve, reject) => {
            taskOptions.accept = (message?: { data: string[] }) => {
                this.smsStack.splice(0, 1)
                if (taskOptions.finished) {
                    throw new Error('Already called')
                } else {
                    taskOptions.finished = true
                    resolve(message)
                }
            }
            taskOptions.reject = (message: { code?: number, err: string, data: string[] }) => {
                this.smsStack.splice(0, 1)
                if (taskOptions.finished) {
                    throw new Error('Already called')
                } else {
                    taskOptions.finished = true
                    reject(message)
                }
            }
        })
        if (this.options.timeout) {
            Sleep.create(this.options.timeout, `${task}_timeout`).then(() => {
                if (!taskOptions.finished) {
                    taskOptions.reject({
                        data: [],
                        err: `Task ${task} timeout`
                    })
                }
            })
        }
        this.smsStack.push(taskOptions)
        this.debug(`Task ${task} created`)
        this.emit('task_created')
        return taskOptions.promise
    }
}
