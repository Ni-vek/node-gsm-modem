import EventEmitter from 'events'
import SerialPort, {parsers} from 'serialport'
import TaskOptions from './interfaces/TaskOptions'
import Sleep from './lib/Sleep'

// import debug from 'debug'

export default class GsmModem extends EventEmitter {

    private static parseResponse(data: string) {
        const plain = data.slice(data.indexOf(':') + 1).trim()
        const parts = plain.split(/,(?=(?:[^"]|"[^"]*")*$)/)

        for (const part of parts) {
            part.replace(/"/g, '')
        }
        return parts
    }

    public smsStack: TaskOptions[]
    public serialPort: SerialPort
    private readonly port: string
    private readonly options: object
    private parser!: parsers.Readline
    private taskOptions!: TaskOptions

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
        this.port = port
        this.options = {
            autoOpen: true,
            baudRate: 9600,
            dataBits: 8,
            lock: true,
            parity: 'none',
            retry: 0,
            rtscts: true,
            smsQueueWaitTime: 5000,
            stopBits: 1,
            timeout: 15000
        }
        if (!options) {
            options = {}
        }
        for (const key in options) {
            if (options.hasOwnProperty(key)) {
                this.options[key] = options[key]
            }
        }
        this.serialPort = new SerialPort(this.port, this.options, () => {
            // debug('serial port opened')
            this.parser = this.serialPort.pipe(new parsers.Readline({delimiter: Buffer.from('\n', 'utf8')}))
            this.emit('open')
            this.parser.on('data', (data: string) => {
                this.dispatchData(data)
            })
            this.processQueue(this.getStack())
        })
        this.smsStack = []
    }

    // Real life commands
    public async sendSms(smsInfo: { receiver: string, text: string, mode?: number }) {
        return this.reset()
            .then(() => this.smsMode(smsInfo.mode || 0))
            .then(() => this.set('CMGS', `"${smsInfo.receiver}"`, {retry: 0}))
            .then(() => this.exec(smsInfo.text + '\u001a'))
            .catch(err => {
                throw new Error(err)
            })
    }

    public async reset() {
        return this.exec('ATZ')
    }

    public async smsMode(mode: number) {
        return this.set('CMGF', mode)
    }

    public async id() {
        return this.exec('ATI')
    }

    public async imsi() {
        return this.test('CIMI').then(isOK => {
            return this.exec('CIMI')
        })
    }

    public async model() {
        return this.test('CGMM').then(isOK => {
            return this.exec('CGMM')
        })
    }

    public async version() {
        // AT+CGMR
        return this.test('GMR').then(isOK => {
            return this.exec('GMR')
        })
    }

    public async manufacturer() {
        // AT+CGMI
        return this.test('CGMI').then(isOK => {
            return this.exec('CGMI')
        })
    }

    public async clock() {
        return this.test('CCLK')
    }

    public async signalStrength() {
        // return this.test('CSQ').then(() => {
        // this.get('CSQ').then(res => {
        //   return res.match(/\+CSQ:\s(.+)/)[1]
        // })
        return this.exec('CSQ')
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
        return this.test('CSCA')
    }

    public async smsList() {
        return this.get('CMGL', {waitBeforeClose: 2000})
    }

    public async smsRead(index: number) {
        return this.set('CMGR', index)
    }

    public async smsDelete(index: number) {
        return this.set('CMGD', index)
    }

    public async setSmsReceivedListener() {
        return this.set('CNMI', '2,1,0,2,0')
    }

    public async debug(n: number) {
        return this.set('CMEE', n || 0)
    }

    public async dial(phone: number) {
        return this.exec(`ATD${phone}`)
    }

    public async hangup() {
        return this.exec('ATH')
    }

    // Commands creators
    private async test(cmd: string) {
        return this.createTask(`AT+${cmd}?`)
    }

    private async exec(cmd: string) {
        return this.createTask(`AT+${cmd}`)
    }

    private async get(name: string, options: object) {
        return this.createTask(`AT+${name}`, options)
    }

    private async set(name: string, value: string | number, options?: object) {
        return this.createTask(`AT+${name}=${value}`, options)
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

    private processQueue(iterator: IterableIterator<TaskOptions | null>) {
        const nextTask = iterator.next().value
        const self = this
        if (nextTask) {
            this.on('data', parseResponse)
            this.serialPort.write(nextTask.task + '\r', (writeErr) => {
                if (writeErr) {
                    nextTask.reject(writeErr)
                } else {
                    this.serialPort.drain((drainErr) => {
                        if (drainErr) {
                            nextTask.reject(drainErr.message)
                        } else {
                            if (!nextTask.options.expectedReturn) {
                                nextTask.accept()
                            }
                        }
                    })
                }
            })
        } else {
            // debug(`No task to do. Waiting for ${this.options}ms`)
            Sleep.create(5000).then(() => { this.processQueue(iterator) })
        }

        function parseResponse(data: string) {
            if ( nextTask) {
                if (new RegExp(nextTask.options.expectedReturn)) {
                    nextTask.accept(data)
                } else {
                    nextTask.reject(`data expected does not match real data received - ${data}`)
                }
            }
            self.removeListener('data', parseResponse)
        }
    }

    private dispatchData(data: string) {
        // New SMS
        if (/\+CMTI/.test(data)) {
            const messageInfo = GsmModem.parseResponse(data)
            console.log(messageInfo)
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

    private async createTask(task: string, options?: object): Promise<boolean> {
        this.taskOptions.task = task
        const command = Object.assign({}, this.taskOptions)
        command.options = Object.assign(this.taskOptions.options, options || {})
        command.promise = new Promise((resolve, reject) => {
            command.accept = (message?: string) => {
                if (command.finished) {
                    throw new Error('Already called')
                } else {
                    command.finished = true
                    resolve(message)
                    return true
                }
            }
            command.reject = (message: string) => {
                if (command.finished) {
                    throw new Error('Already called')
                } else {
                    command.finished = true
                    reject(message)
                    return new Error(message)
                }
            }
        })
        this.smsStack.push(command)
        return true
    }
}
