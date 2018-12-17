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
	// modem.setSmsReceivedListener().then((...listen) => {
	//     console.log(listen)
	// })
	// modem.signalStrength().then((...signal) => {
	//     console.log('signal', signal);
	// });
	// modem.customCommand('AT+CPIN?', { expectedReturn: /OK/, postProcessFunction: (data) => {
	//     console.log('Post process function', data);
	//     return data[1]
	// } }).then((pin) => {
	//     console.log(pin)
	// })
	// setTimeout(() => {
	// 	modem.sendSms({ receiver: '0614284000', text: 'Re-Salut Baloche'}).then((...args) => {
	// 		console.log('OK', args);
	// 	}).catch((...err) => {
	// 		console.log('Err', err);
	// 	})
	// }, 3000)
	//
	// setTimeout(() => {
	// 	modem.sendSms({ receiver: PHONE_NUMBER, text: 'Salut mon petit'}).then((...args) => {
	// 		console.log('OK', args);
	// 		modem.signalStrength().then((...listen) => {
	// 			console.log(listen)
	// 		})
	// 	}).catch((...err) => {
	// 		console.log('Err', err);
	// 	})
	// }, 10000)
	// setTimeout(() => {
	//
	// 	modem.setSmsReceivedListener().then((...signal) => {
	// 		console.log(signal);
	// 	});
	// }, 15000)
});
