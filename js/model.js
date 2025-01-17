/**
 * class Model
 * Loads the Tensorflow model and preprocesses and predicts images
 */
class Model {
	/**
	 * Initializes the Model class, loads and warms up the model, etc
	 */
	constructor(letteranddigit) {
		if (letteranddigit){
		this.alphabet = "abcdefghijklmnopqrstuvwxyz";
		this.characters = "0123456789" + this.alphabet.toUpperCase() + this.alphabet
		}else {
//			this.alphabet = "abcdefghijklmnopqrstuvwxyz";
			this.characters = "0123456789" 
	
		}
		this.isWarmedUp = this.loadModel(letteranddigit)
			.then()
			.then(() => console.info("Backend running on:", tf.getBackend()))
	}

	/**
	 * Loads the model
	 */
	loadModel(letteranddigit) {
		console.time("Load model")
		if (letteranddigit){
		return tf.loadLayersModel("js/letteranddigitclassifier/model.json").then(model => {
			this._model = model;
			console.timeEnd("Load model")
		})
		}else{
			return tf.loadLayersModel("js/digitclassifier/model.json").then(model => {
				this._model = model;
				console.timeEnd("Load model")
			})
	
		}
	}

	/**
	 * Runs a prediction with random data to warm up the GPU
	 */
	warmUp() {
		console.time("Warmup")
		this._model.predict(tf.randomNormal([1,28,28,1])).as1D().dataSync()
		this.isWarmedUp = true;
		console.timeEnd("Warmup")
	}


	/**
	 * Takes an ImageData object and reshapes it to fit the model
	 * @param {ImageData} pixelData
	 */
	 preprocessImage(pixelData) {

		const targetDim = 28,
			edgeSize = 2,
			resizeDim = targetDim-edgeSize*2,
			padVertically = pixelData.width > pixelData.height,
			padSize = Math.round((Math.max(pixelData.width, pixelData.height) - Math.min(pixelData.width, pixelData.height))/2),
			padSquare = padVertically ? [[padSize,padSize], [0,0], [0,0]] : [[0,0], [padSize,padSize], [0,0]];

		let	tempImg = null;

		// remove the previous image to avoid memory leak
		if(tempImg) tempImg.dispose();

		return tf.tidy(() => {
			// convert the pixel data into a tensor with 1 data channel per pixel
			// i.e. from [h, w, 4] to [h, w, 1]
			let tensor = tf.browser.fromPixels(pixelData, 1)
				// pad it such that w = h = max(w, h)
				.pad(padSquare, 255.0)

			// scale it down
			tensor = tf.image.resizeBilinear(tensor, [resizeDim, resizeDim])
				// pad it with blank pixels along the edges (to better match the training data)
				.pad([[edgeSize,edgeSize], [edgeSize,edgeSize], [0,0]], 255.0)

			// invert and normalize to match training data
			tensor = tf.scalar(1.0).sub(tensor.toFloat().div(tf.scalar(255.0)))

			// display what the model will see (keeping the tensor outside the tf.tidy scope is necessary)
			tempImg = tf.keep(tf.clone(tensor))

			// Reshape again to fit training model [N, 28, 28, 1]
			// where N = 1 in this case
			return tensor.expandDims(0)
		});
	}

	/**
	 * Takes an ImageData objects and predict a character
	 * @param {ImageData} pixelData
	 * @returns {string} character
	 */
	 predict(pixelData) {

		if(!this._model) return console.warn("Model not loaded yet!");
	//	console.time("Prediction")
		let tensor = this.preprocessImage(pixelData);
		let prediction = this._model.predict(tensor).as1D();
			// get the index of the most probable character
		let argMax = prediction.argMax().dataSync()[0];
		let probability = prediction.max().dataSync()[0];
			// get the character at that index
		let character = this.characters[argMax];
		
		// console.log("Predicted", character, "Probability", probability)
		//console.timeEnd("Prediction")
		return [character, probability]
	}

	/**
	 * Helper function, to easier debug tensors
	 * @param {string} name
	 * @param {tf.tensor} tensor
	 * @param {int} width
	 * @param {int} height
	 */
	static log(name, tensor, width = 28, height = 28) {

		tensor = tensor.dataSync()
		console.log("Tensor name", name, tensor)
		for(let i = 0; i<width*height; i+=width) {
			console.log(tensor.slice(i,i+width).reduce((acc, cur) => acc + ((cur === 0 ? "0" : "1")+"").padStart(2)), "")
		}
	}
}