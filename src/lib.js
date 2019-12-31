const uuidv1 = require('uuid/v1');
function createUUID(){
	return uuidv1();
}

export {
	createUUID
}