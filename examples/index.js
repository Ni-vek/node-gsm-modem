const { SmsModem } = require('./../dist/main');
const SerialPort = require('serialport');
const PHONE_NUMBER = 'YOUR_PHONE_NUMBER';
let modem = new SmsModem('/dev/tty.usbmodem14101', {
	retry: 0,
	timeout: 15000,
	dataBits: 8,
	stopBits: 1,
	baudRate: 9600,
	parity: 'none',
	autoOpen: false,
	lock: true,
	rtscts: true,
	smsQueueWaitTime: 100
});
modem.on('open', () => {
});
