import debug = require('debug')
import {EventEmitter} from 'events'
import SerialPort = require('serialport')
import Options from './interfaces/Options'
import TaskOptions from './interfaces/TaskOptions'
import Sleep from './lib/Sleep'

type MixedOptions = Options & SerialPort.OpenOptions

class SmsModem extends EventEmitter {

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
            this.activateStatusReport(),
            this.setSmsMode(smsInfo.mode || 1),
            this.setReceiver(smsInfo.receiver),
            this.setTextMessage(smsInfo.text)
        ])
    }

    public async activateErrorsCodes() {
        return this.createTask(`AT+CMEE=1`, {expectedReturn: /OK/})
    }

    public activateStatusReport() {
        return this.createTask(`AT+CSMP=33,,0,0`, {expectedReturn: /OK/})
    }

    public async customCommand(cmd: string, options: {
        expectedReturn: RegExp,
        postProcessFunction?: (data: string[]) => any
    }) {
        return this.createTask(cmd, options)
    }

    public async setPinCode(pin: string | number) {
        return this.createTask(`AT+CPIN=${pin}`, {expectedReturn: /OK/})
            .then(() => this.checkPinCode())
    }

    public async checkPinCode() {
        return this.createTask(`AT+CPIN?`, {
            expectedReturn: /\+CPIN:/,
            postProcessFunction: (data: string[]) => {
                const result: { error: string|undefined, result: boolean } = {
                    error: undefined,
                    result: false
                }
                for (const line of data) {
                    if (line) {
                        if (/READY/.test(line)) {
                            result.result = true
                        } else if (/PIN/.test(line)) {
                            result.result = false
                            result.error = 'Wrong PIN provided'
                        } else if (/PUK/.test(line)) {
                            result.result = false
                            result.error = 'PUK code wanted'
                        }
                    }
                }
                return result
            }
        })
    }

    public async unlockSimPin(pin: string|number) {
        return this.createTask(`AT+CLCK="SC",0,${pin}`, {expectedReturn: /OK/})
    }

    public async lockSimPin(pin: string|number) {
        return this.createTask(`AT+CLCK="SC",1,${pin}`, {expectedReturn: /OK/})
    }

    public async changePin(oldPin: string|number, newPin: string|number) {
        return this.createTask(`AT+CPWD="SC",${oldPin},${newPin}`, {expectedReturn: /OK/})
            .then(() => this.setPinCode(newPin))
    }

    public async checkGsmNetwork() {
        return this.createTask(`AT+CREG?`, {
            expectedReturn: /\+CREG:/,
            postProcessFunction: (data: string[]) => {
                const result: { error: string|undefined, result: boolean } = {
                    error: undefined,
                    result: false
                }
                for (const line of data) {
                    if (line) {
                        if (/0,[15]/.test(line)) {
                            result.result = true
                        } else if (/PIN/.test(line)) {
                            result.result = false
                            result.error = 'Searching for network'
                        }
                    }
                }
                return result
            }
        })
    }

    public async id() {
        return this.createTask('ATI', {expectedReturn: /.+/})
    }

    public async imsi() {
        return this.createTask('AT+CIMI', {expectedReturn: /[0-9]+/})
    }

    public async model() {
        return this.createTask('AT+CGMM', {expectedReturn: /.+/})
    }

    public async version() {
        // AT+CGMR
        return this.createTask('AT+CGMR', {expectedReturn: /.+/})
    }

    public async manufacturer() {
        // AT+CGMI
        return this.createTask('AT+CGMI', {expectedReturn: /.+/})
    }

    public async clock() {
        return this.createTask('AT+CCLK?', {
            expectedReturn: /\+CCLK:/,
            postProcessFunction: (data: string[]) => {
                const result: { date: string, time: string } = {
                    date: '',
                    time: ''
                }
                for (const line of data) {
                    if (line) {
                        let res: RegExpMatchArray | null = line.match(/\+CSQ:\s*(.+)/)
                        if (res) {
                            res = res[1].trim().replace(/"/g, '').split(',')
                            result.date = res[0]
                            result.time = res[1]
                        }
                    }
                }
                return result
            }
        })
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
                            res = res[1].trim().replace(/"/g, '').split(',')
                            result.ber = res[1]
                            result.rssi = res[0]
                        }
                    }
                }
                return result
            }
        })
    }

    public async smsCenter() {
        return this.createTask('AT+CSCA?', {
            expectedReturn: /\+CSCA/,
            postProcessFunction: (data: string[]) => {
                const result: { ber: string, rssi: string } = {
                    ber: '',
                    rssi: ''
                }
                for (const line of data) {
                    if (line) {
                        let res: RegExpMatchArray | null = line.match(/\+CSQ:\s*(.+)/)
                        if (res) {
                            res = res[1].trim().replace(/"/g, '').split(',')
                            result.ber = res[1]
                            result.rssi = res[0]
                        }
                    }
                }
                return result
            }
        })
    }
    // TODO wait for serial port to send OK after the SMS list
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

    public async saveConfiguration() {
        return this.createTask('AT&W', { expectedReturn: /OK/})
    }

    public async currentConfiguration() {
        return this.createTask('AT&V', { expectedReturn: /ACTIVE PROFILE/})
    }

    public async deleteSms(index: number) {
        return this.createTask(`AT+CMGD=${index}`, {expectedReturn: /OK/})
    }

    public async deleteAllSms() {
        return this.createTask(`AT+CMGD=1,4`, {expectedReturn: /OK/})
    }

    public async setSmsReceivedListener() {
        return this.createTask(`AT+CNMI=2,1,0,2,0`, {expectedReturn: /OK/})
            .then(() => this.saveConfiguration())
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

    // private async reset() {
    //     return this.createTask('ATZ', {expectedReturn: /OK/})
    // }

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
            if (buffer) {
                if (nextTask) {
                    self.debug(`Parsing response for command ${nextTask.task} - ${data}`)
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
        this.emit('task_created')
        return taskOptions.promise
    }
}

export = {SmsModem}
