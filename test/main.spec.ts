import MockBinding = require('@serialport/binding-mock')
import SerialPort = require('serialport')
import SmsModem from '../src/main'

let modem: SmsModem

describe('SmsModem unit tests', () => {
    // Create the mock of serial port
    beforeEach((done) => {
        SerialPort.Binding = MockBinding
        MockBinding.createPort('/dev/tty.usbModem', {echo: false, record: true})
        modem = new SmsModem('/dev/tty.usbModem', {
            autoOpen: true,
            baudRate: 9600,
            dataBits: 8,
            lock: true,
            parity: 'none',
            retry: 0,
            rtscts: true,
            smsQueueWaitTime: 100,
            stopBits: 1,
            timeout: 15000
        })
        modem.on('open', done)
    })
    afterEach((done) => {
        modem.serialPort.close(() => {
            done()
        })
    })
    // Cleaning serial port
    // beforeEach((done) => {
    //     modem.serialPort.flush(() => {
    //         done()
    //     })
    // })
    describe('Custom command tests', () => {
        test('should resolve the promise as the data return from the serial port matches the expected data', () => {
            expect.assertions(1)
            const cmd = modem.customCommand('RESOLVE_TEST', {expectedReturn: /RESOLVE_TEST/}).then((data) => {
                expect(data.data[0]).toMatch(/RESOLVE_TEST/)
            })
            modem.serialPort.binding.emitData('RESOLVE_TEST')
            return cmd
        })
        test('should reject the promise as the data return does not match the expected data', () => {
            expect.assertions(2)
            const cmd = modem.customCommand('REJECTION_TEST', {expectedReturn: /FALSE_EXPECTED_RETURN/}).catch((data) => {
                expect(data.data[0]).toMatch(/REJECTION_TEST_RETURN/)
                expect(data.err).toMatch(`Expected data /FALSE_EXPECTED_RETURN/, does not match real data received REJECTION_TEST_RETURN, for command REJECTION_TEST`)
            })
            modem.serialPort.binding.emitData('REJECTION_TEST_RETURN')
            return cmd
        })
    })
    describe('Activate errors codes command tests', () => {
        test('should resolve the promise as the data return from the serial port matches the default expected data', () => {
            expect.assertions(1)
            const cmd = modem.activateErrorsCodes().then((data) => {
                expect(data.data[0]).toMatch(/OK/)
            })
            modem.serialPort.binding.emitData('OK')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the default expected data', () => {
            expect.assertions(2)
            const cmd = modem.activateErrorsCodes().catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
        test('should resolve the promise as the data return from the serial port matches the custom expected data', () => {
            expect.assertions(1)
            const cmd = modem.activateErrorsCodes(/COOL/).then((data) => {
                expect(data.data[0]).toMatch(/COOL/)
            })
            modem.serialPort.binding.emitData('COOL')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the custom expected data', () => {
            expect.assertions(2)
            const cmd = modem.activateErrorsCodes(/COOL/).catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
    })
    describe('Errors codes resolver', () => {
        test('should handle the correct CME error', () => {
            expect.assertions(2)
            const cmd = modem.customCommand('AT+FALSE_COMMAND', {expectedReturn: /OK/}).catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
        test('should handle the correct CMS error', () => {
            expect.assertions(2)
            const cmd = modem.customCommand('AT+FALSE_COMMAND', {expectedReturn: /OK/}).catch((data) => {
                expect(data.code).toBe('538')
                expect(data.err).toBe('Invalid parameter')
            })
            modem.serialPort.binding.emitData('+CMS ERROR: 538')
            return cmd
        })
    })
    describe('Activate status report command tests', () => {
        test('should resolve the promise as the data return from the serial port matches the default expected data', () => {
            expect.assertions(1)
            const cmd = modem.activateStatusReport().then((data) => {
                expect(data.data[0]).toMatch(/OK/)
            })
            modem.serialPort.binding.emitData('OK')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the default expected data', () => {
            expect.assertions(2)
            const cmd = modem.activateStatusReport().catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
        test('should resolve the promise as the data return from the serial port matches the custom expected data', () => {
            expect.assertions(1)
            const cmd = modem.activateStatusReport(/COOL/).then((data) => {
                expect(data.data[0]).toMatch(/COOL/)
            })
            modem.serialPort.binding.emitData('COOL')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the custom expected data', () => {
            expect.assertions(2)
            const cmd = modem.activateStatusReport(/COOL/).catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
    })
    describe('Set pin code command tests', () => {
        test('should resolve the promise as the data return from the serial port matches the default expected data', () => {
            expect.assertions(1)
            const cmd = modem.setPinCode(1234).then((data) => {
                expect(data.data[0]).toMatch(/OK/)
            })
            modem.serialPort.binding.emitData('OK')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the default expected data', () => {
            expect.assertions(2)
            const cmd = modem.setPinCode(1234).catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
        test('should resolve the promise as the data return from the serial port matches the custom expected data', () => {
            expect.assertions(1)
            const cmd = modem.setPinCode(1234, /COOL/).then((data) => {
                expect(data.data[0]).toMatch(/COOL/)
            })
            modem.serialPort.binding.emitData('COOL')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the custom expected data', () => {
            expect.assertions(2)
            const cmd = modem.setPinCode(1234, /COOL/).catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
    })
    describe('Check pin code command tests', () => {
        test('should resolve the promise as the data return from the serial port matches the default expected data', () => {
            expect.assertions(1)
            const cmd = modem.checkPinCode().then((data) => {
                expect(data.data[0]).toBe('+CPIN: READY')
            })
            modem.serialPort.binding.emitData('+CPIN: READY')
            return cmd
        })
        test('should reject the promise as the pin provided was wrong', () => {
            expect.assertions(1)
            const cmd = modem.checkPinCode().catch((data) => {
                expect(data.data[0]).toBe('+CPIN: PIN')
            })
            modem.serialPort.binding.emitData('+CPIN: PIN')
            return cmd
        })
    })
    describe('Unlock pin code command tests', () => {
        test('should resolve the promise as the data return from the serial port matches the default expected data', () => {
            expect.assertions(1)
            const cmd = modem.unlockSimPin(1234).then((data) => {
                expect(data.data[0]).toMatch(/OK/)
            })
            modem.serialPort.binding.emitData('OK')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the default expected data', () => {
            expect.assertions(2)
            const cmd = modem.unlockSimPin(1234).catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
        test('should resolve the promise as the data return from the serial port matches the custom expected data', () => {
            expect.assertions(1)
            const cmd = modem.unlockSimPin(1234, /COOL/).then((data) => {
                expect(data.data[0]).toMatch(/COOL/)
            })
            modem.serialPort.binding.emitData('COOL')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the custom expected data', () => {
            expect.assertions(2)
            const cmd = modem.unlockSimPin(1234, /COOL/).catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
    })
    describe('Lock pin code command tests', () => {
        test('should resolve the promise as the data return from the serial port matches the default expected data', () => {
            expect.assertions(1)
            const cmd = modem.lockSimPin(1234).then((data) => {
                expect(data.data[0]).toMatch(/OK/)
            })
            modem.serialPort.binding.emitData('OK')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the default expected data', () => {
            expect.assertions(2)
            const cmd = modem.lockSimPin(1234).catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
        test('should resolve the promise as the data return from the serial port matches the custom expected data', () => {
            expect.assertions(1)
            const cmd = modem.lockSimPin(1234, /COOL/).then((data) => {
                expect(data.data[0]).toMatch(/COOL/)
            })
            modem.serialPort.binding.emitData('COOL')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the custom expected data', () => {
            expect.assertions(2)
            const cmd = modem.lockSimPin(1234, /COOL/).catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
    })
    describe('Change pin code command tests', () => {
        test('should resolve the promise as the data return from the serial port matches the default expected data', () => {
            expect.assertions(1)
            const cmd = modem.changePin(1234, 4321).then((data) => {
                expect(data.data[0]).toMatch(/OK/)
            })
            modem.serialPort.binding.emitData('OK')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the default expected data', () => {
            expect.assertions(2)
            const cmd = modem.changePin(1234, 4321).catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
        test('should resolve the promise as the data return from the serial port matches the custom expected data', () => {
            expect.assertions(1)
            const cmd = modem.changePin(1234, 4321, /COOL/).then((data) => {
                expect(data.data[0]).toMatch(/COOL/)
            })
            modem.serialPort.binding.emitData('COOL')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the custom expected data', () => {
            expect.assertions(2)
            const cmd = modem.changePin(1234, 4321, /COOL/).catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
    })
    describe('Check gsm networks command tests', () => {
        test('should resolve the promise as the gsm network can be reached', () => {
            expect.assertions(1)
            const cmd = modem.checkGsmNetwork().then((data) => {
                expect(data.data[0]).toBe('+CREG: 0,5')
            })
            modem.serialPort.binding.emitData('+CREG: 0,5')
            return cmd
        })
        test('should reject the promise as the modem is searching for a network', () => {
            expect.assertions(1)
            const cmd = modem.checkGsmNetwork().catch((data) => {
                expect(data.err).toBe('Searching for network')
            })
            modem.serialPort.binding.emitData('+CREG: 0,2')
            return cmd
        })
    })
    describe('Modem ID command tests', () => {
        test('should resolve the promise as the data return from the serial port matches the default expected data', () => {
            expect.assertions(1)
            const cmd = modem.id().then((data) => {
                expect(data.data[0]).toMatch(/Modem Id/)
            })
            modem.serialPort.binding.emitData('Modem Id')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the default expected data', () => {
            expect.assertions(2)
            const cmd = modem.id().catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
        test('should resolve the promise as the data return from the serial port matches the custom expected data', () => {
            expect.assertions(1)
            const cmd = modem.id(/COOL/).then((data) => {
                expect(data.data[0]).toMatch(/COOL/)
            })
            modem.serialPort.binding.emitData('COOL')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the custom expected data', () => {
            expect.assertions(2)
            const cmd = modem.id(/COOL/).catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
    })
    describe('IMSI command tests', () => {
        test('should resolve the promise as the data return from the serial port matches the default expected data', () => {
            expect.assertions(1)
            const cmd = modem.imsi().then((data) => {
                expect(data.data[0]).toMatch(/1234567890/)
            })
            modem.serialPort.binding.emitData('1234567890')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the default expected data', () => {
            expect.assertions(2)
            const cmd = modem.imsi().catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
        test('should resolve the promise as the data return from the serial port matches the custom expected data', () => {
            expect.assertions(1)
            const cmd = modem.imsi(/COOL/).then((data) => {
                expect(data.data[0]).toMatch(/COOL/)
            })
            modem.serialPort.binding.emitData('COOL')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the custom expected data', () => {
            expect.assertions(2)
            const cmd = modem.imsi(/COOL/).catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
    })
    describe('Modem model command tests', () => {
        test('should resolve the promise as the data return from the serial port matches the default expected data', () => {
            expect.assertions(1)
            const cmd = modem.model().then((data) => {
                expect(data.data[0]).toMatch(/MySuperModem x767/)
            })
            modem.serialPort.binding.emitData('MySuperModem x767')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the default expected data', () => {
            expect.assertions(2)
            const cmd = modem.model().catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
        test('should resolve the promise as the data return from the serial port matches the custom expected data', () => {
            expect.assertions(1)
            const cmd = modem.model(/COOL/).then((data) => {
                expect(data.data[0]).toMatch(/COOL/)
            })
            modem.serialPort.binding.emitData('COOL')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the custom expected data', () => {
            expect.assertions(2)
            const cmd = modem.model(/COOL/).catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
    })
    describe('Modem version command tests', () => {
        test('should resolve the promise as the data return from the serial port matches the default expected data', () => {
            expect.assertions(1)
            const cmd = modem.version().then((data) => {
                expect(data.data[0]).toMatch(/v1\.2\.3/)
            })
            modem.serialPort.binding.emitData('v1.2.3')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the default expected data', () => {
            expect.assertions(2)
            const cmd = modem.version().catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
        test('should resolve the promise as the data return from the serial port matches the custom expected data', () => {
            expect.assertions(1)
            const cmd = modem.version(/COOL/).then((data) => {
                expect(data.data[0]).toMatch(/COOL/)
            })
            modem.serialPort.binding.emitData('COOL')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the custom expected data', () => {
            expect.assertions(2)
            const cmd = modem.version(/COOL/).catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
    })
    describe('Modem manufacturer command tests', () => {
        test('should resolve the promise as the data return from the serial port matches the default expected data', () => {
            expect.assertions(1)
            const cmd = modem.manufacturer().then((data) => {
                expect(data.data[0]).toMatch(/SuperManufacturer/)
            })
            modem.serialPort.binding.emitData('SuperManufacturer')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the default expected data', () => {
            expect.assertions(2)
            const cmd = modem.manufacturer().catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
        test('should resolve the promise as the data return from the serial port matches the custom expected data', () => {
            expect.assertions(1)
            const cmd = modem.manufacturer(/COOL/).then((data) => {
                expect(data.data[0]).toMatch(/COOL/)
            })
            modem.serialPort.binding.emitData('COOL')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the custom expected data', () => {
            expect.assertions(2)
            const cmd = modem.manufacturer(/COOL/).catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
    })
    describe('Check modem clock command tests', () => {
        test('should resolve the promise as the modem clock can be read', () => {
            expect.assertions(2)
            const cmd = modem.clock().then((data) => {
                expect(data.transformedData.date).toBe('04/01/11')
                expect(data.transformedData.time).toBe('05:22:09')
            })
            modem.serialPort.binding.emitData('+CCLK: "04/01/11,05:22:09"')
            return cmd
        })
    })
    describe('Check modem signal strength command tests', () => {
        test('should resolve the promise as the signal strength can be read', () => {
            expect.assertions(2)
            const cmd = modem.signalStrength().then((data) => {
                expect(data.transformedData.ber).toBe('99')
                expect(data.transformedData.rssi).toBe('13')
            })
            modem.serialPort.binding.emitData('+CSQ: 13,99')
            return cmd
        })
    })
    describe('Check sms center command tests', () => {
        test('should resolve the promise as the sms center can be read', () => {
            expect.assertions(1)
            const cmd = modem.smsCenter().then((data) => {
                expect(data.transformedData.number).toBe('+33695000695')
            })
            modem.serialPort.binding.emitData('+CSCA: "+33695000695",145')
            return cmd
        })
    })
    describe('Check sms read command tests', () => {
        test('should resolve the promise as the sms can be read', () => {
            expect.assertions(4)
            const cmd = modem.readSms(1).then((data) => {
                expect(data.transformedData.sender).toBe('+33612345678')
                expect(data.transformedData.date).toBe('18/12/17')
                expect(data.transformedData.time).toBe('16:00:57+04')
                expect(data.transformedData.text).toBe('Dhkwgn')
            })
            modem.serialPort.binding.emitData('+CMGR: "REC READ","+33612345678",,"18/12/17,16:00:57+04"\r\nDhkwgn')
            return cmd
        })
    })
    describe('Save configuration command tests', () => {
        test('should resolve the promise as the data return from the serial port matches the default expected data', () => {
            expect.assertions(1)
            const cmd = modem.saveConfiguration().then((data) => {
                expect(data.data[0]).toMatch(/OK/)
            })
            modem.serialPort.binding.emitData('OK')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the default expected data', () => {
            expect.assertions(2)
            const cmd = modem.saveConfiguration().catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
        test('should resolve the promise as the data return from the serial port matches the custom expected data', () => {
            expect.assertions(1)
            const cmd = modem.saveConfiguration(/COOL/).then((data) => {
                expect(data.data[0]).toMatch(/COOL/)
            })
            modem.serialPort.binding.emitData('COOL')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the custom expected data', () => {
            expect.assertions(2)
            const cmd = modem.saveConfiguration(/COOL/).catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
    })
    describe('Read current configuration command tests', () => {
        test('should resolve the promise as the data return from the serial port matches the default expected data', () => {
            expect.assertions(1)
            const cmd = modem.currentConfiguration().then((data) => {
                expect(data.data[0]).toMatch(/ACTIVE PROFILE/)
            })
            modem.serialPort.binding.emitData('ACTIVE PROFILE:\n' +
                'E0 Q0 V1 X0 &C1 &D2 &S0 \\Q3\n' +
                'S0:000 S3:013 S4:010 S5:008 S6:000 S7:060 S8:000 S10:002\n' +
                '+CBST: 71,0,1\n' +
                '+CRLP: 61,61,78,6\n' +
                '+CR: 0\n' +
                '+CRC: 0\n' +
                '+CMGF: 1\n' +
                '+CSDH: 0\n' +
                '+CNMI: 2,1,0,2,0\n' +
                '+CMEE: 1\n' +
                '+CSMS: 0,1,1,1\n' +
                '+CREG: 0,5\n' +
                '+CLIP: 0,2\n' +
                '+COPS: 0,0,"Orange F",0\n' +
                '+CGSMS: 1')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the default expected data', () => {
            expect.assertions(2)
            const cmd = modem.saveConfiguration().catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
        test('should resolve the promise as the data return from the serial port matches the custom expected data', () => {
            expect.assertions(1)
            const cmd = modem.saveConfiguration(/COOL/).then((data) => {
                expect(data.data[0]).toMatch(/COOL/)
            })
            modem.serialPort.binding.emitData('COOL')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the custom expected data', () => {
            expect.assertions(2)
            const cmd = modem.saveConfiguration(/COOL/).catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
    })
    describe('Delete SMS command tests', () => {
        test('should resolve the promise as the data return from the serial port matches the default expected data', () => {
            expect.assertions(1)
            const cmd = modem.deleteSms(1).then((data) => {
                expect(data.data[0]).toMatch(/OK/)
            })
            modem.serialPort.binding.emitData('OK')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the default expected data', () => {
            expect.assertions(2)
            const cmd = modem.deleteSms(1).catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
        test('should resolve the promise as the data return from the serial port matches the custom expected data', () => {
            expect.assertions(1)
            const cmd = modem.deleteSms(1, /COOL/).then((data) => {
                expect(data.data[0]).toMatch(/COOL/)
            })
            modem.serialPort.binding.emitData('COOL')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the custom expected data', () => {
            expect.assertions(2)
            const cmd = modem.deleteSms(1, /COOL/).catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
    })
    describe('Delete SMS command tests', () => {
        test('should resolve the promise as the data return from the serial port matches the default expected data', () => {
            expect.assertions(1)
            const cmd = modem.deleteAllSms().then((data) => {
                expect(data.data[0]).toMatch(/OK/)
            })
            modem.serialPort.binding.emitData('OK')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the default expected data', () => {
            expect.assertions(2)
            const cmd = modem.deleteAllSms().catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
        test('should resolve the promise as the data return from the serial port matches the custom expected data', () => {
            expect.assertions(1)
            const cmd = modem.deleteAllSms(/COOL/).then((data) => {
                expect(data.data[0]).toMatch(/COOL/)
            })
            modem.serialPort.binding.emitData('COOL')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the custom expected data', () => {
            expect.assertions(2)
            const cmd = modem.deleteAllSms(/COOL/).catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
    })
    describe('Set new SMS listener command tests', () => {
        test('should resolve the promise as the data return from the serial port matches the default expected data', () => {
            expect.assertions(1)
            const cmd = modem.setSmsReceivedListener().then((data) => {
                expect(data.data[0]).toMatch(/OK/)
            })
            modem.serialPort.binding.emitData('OK')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the default expected data', () => {
            expect.assertions(2)
            const cmd = modem.setSmsReceivedListener().catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
        test('should resolve the promise as the data return from the serial port matches the custom expected data', () => {
            expect.assertions(1)
            const cmd = modem.setSmsReceivedListener(/COOL/).then((data) => {
                expect(data.data[0]).toMatch(/COOL/)
            })
            modem.serialPort.binding.emitData('COOL')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the custom expected data', () => {
            expect.assertions(2)
            const cmd = modem.setSmsReceivedListener(/COOL/).catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
    })
    describe('Set new SMS receiver command tests', () => {
        test('should resolve the promise as the data return from the serial port matches the default expected data', () => {
            expect.assertions(1)
            const cmd = modem.setReceiver('+33612345678').then((data) => {
                expect(data.data[0]).toMatch(/>/)
            })
            modem.serialPort.binding.emitData('>')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the default expected data', () => {
            expect.assertions(2)
            const cmd = modem.setReceiver('+33612345678').catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
        test('should resolve the promise as the data return from the serial port matches the custom expected data', () => {
            expect.assertions(1)
            const cmd = modem.setReceiver('+33612345678', /COOL/).then((data) => {
                expect(data.data[0]).toMatch(/COOL/)
            })
            modem.serialPort.binding.emitData('COOL')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the custom expected data', () => {
            expect.assertions(2)
            const cmd = modem.setReceiver('+33612345678', /COOL/).catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
    })
    describe('Set new SMS text command tests', () => {
        test('should resolve the promise as the data return from the serial port matches the default expected data', () => {
            expect.assertions(1)
            const cmd = modem.setTextMessage('Test message').then((data) => {
                expect(data.data[0]).toMatch(/\+CMGS/)
            })
            modem.serialPort.binding.emitData('+CMGS')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the default expected data', () => {
            expect.assertions(2)
            const cmd = modem.setTextMessage('Test message').catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
        test('should resolve the promise as the data return from the serial port matches the custom expected data', () => {
            expect.assertions(1)
            const cmd = modem.setTextMessage('Test message', /COOL/).then((data) => {
                expect(data.data[0]).toMatch(/COOL/)
            })
            modem.serialPort.binding.emitData('COOL')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the custom expected data', () => {
            expect.assertions(2)
            const cmd = modem.setTextMessage('Test message', /COOL/).catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
    })
    describe('Reset modem command tests', () => {
        test('should resolve the promise as the data return from the serial port matches the default expected data', () => {
            expect.assertions(1)
            const cmd = modem.resetModem().then((data) => {
                expect(data.data[0]).toMatch(/OK/)
            })
            modem.serialPort.binding.emitData('OK')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the default expected data', () => {
            expect.assertions(2)
            const cmd = modem.resetModem().catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
        test('should resolve the promise as the data return from the serial port matches the custom expected data', () => {
            expect.assertions(1)
            const cmd = modem.resetModem(/COOL/).then((data) => {
                expect(data.data[0]).toMatch(/COOL/)
            })
            modem.serialPort.binding.emitData('COOL')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the custom expected data', () => {
            expect.assertions(2)
            const cmd = modem.resetModem(/COOL/).catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
    })
    describe('Set sms mode command tests', () => {
        test('should resolve the promise as the data return from the serial port matches the default expected data', () => {
            expect.assertions(1)
            const cmd = modem.setSmsMode(0).then((data) => {
                expect(data.data[0]).toMatch(/OK/)
            })
            modem.serialPort.binding.emitData('OK')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the default expected data', () => {
            expect.assertions(2)
            const cmd = modem.setSmsMode(0).catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
        test('should resolve the promise as the data return from the serial port matches the custom expected data', () => {
            expect.assertions(1)
            const cmd = modem.setSmsMode(0, /COOL/).then((data) => {
                expect(data.data[0]).toMatch(/COOL/)
            })
            modem.serialPort.binding.emitData('COOL')
            return cmd
        })
        test('should reject the promise as the data return from the serial port does not match the custom expected data', () => {
            expect.assertions(2)
            const cmd = modem.setSmsMode(0, /COOL/).catch((data) => {
                expect(data.code).toBe('100')
                expect(data.err).toBe('Unknown error')
            })
            modem.serialPort.binding.emitData('+CME ERROR: 100')
            return cmd
        })
    })
})
