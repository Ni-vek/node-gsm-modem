const { SmsModem } = require('./../dist/main');
let modem = new SmsModem('/dev/tty.usbmodem14101', {
	retry: 0,
	timeout: 15000,
	dataBits: 8,
	stopBits: 1,
	baudRate: 9600,
	parity: 'none',
	autoOpen: true,
	lock: true,
	rtscts: true,
	newMessageEvent: true
});
modem.on('open', () => {
	modem.setSmsReceivedListener().then((...listen) => {
	    console.log(listen)
	})
	modem.signalStrength().then((...signal) => {
	    console.log('signal', signal);
	});
	// setTimeout(() => {
	// 	modem.sendSms({ receiver: '0614284000', text: 'Re-Salut Baloche'}).then((...args) => {
	// 		console.log('OK', args);
	// 	}).catch((...err) => {
	// 		console.log('Err', err);
	// 	})
	// }, 3000)
	//
	// setTimeout(() => {
	// 	modem.sendSms({ receiver: '0614284000', text: 'Salut mon petit'}).then((...args) => {
	// 		console.log('OK', args);
	// 	}).catch((...err) => {
	// 		console.log('Err', err);
	// 	})
	// }, 10000)
})


