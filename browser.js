var ipc 			= require('ipc'),
	fs 				= require('fs'),
	shell 			= require('shell'),
	uglifyjs 		= require('uglify-js'),
	tsc 			= require('typescript-compiler'),
	path 			= require('path'),
	Gaze 			= require('gaze'),
	_ 				= require('lodash'),
	currentFile		= 0,
	gaze,
	start,
	end;

$('#menu').on('click', function () {
	if( $('#menuOptions').css('display') === 'none' ) {
		$('#menuOptions').css('display', 'inline-block');
	} else {
		$('#menuOptions').css('display', 'none');
	}
});

function watchDirectory (bool) {
	if (bool) {
		console.log("Watched Dir: " + options.watch.directory);
		gaze = null;
		gaze = new Gaze('*.ts', {cwd: options.watch.directory}, function (err, watcher) {
			this.on('changed', function (filepath) {
				console.log(filepath + ' was changed');
				var dest = getDestination(filepath);
				start = +new Date();
				readTypeFile(filepath, dest, compileType);
			});

			this.on('added', function (filepath) {
				console.log(filepath + ' was added');
				var dest = getDestination(filepath);
				start = +new Date();
				readTypeFile(filepath, dest, compileType);
			});
		});
	} else {
		try {
			gaze.close();
			gaze = null;
		} catch (err) {
			console.log('No watch open');
		}
	}
};

var holder = document.getElementById('holder');

holder.ondragover = function () { return false; };
holder.ondragleave = holder.ondragend = function () { return false; };

holder.ondrop = function (e) {
	e.preventDefault();
	start = +new Date();
	var files = e.dataTransfer.files;
	var file = e.dataTransfer.files[0];
	var dest = getDestination(file.path);
	if ( files.length === 1 ) {
		var extension = path.extname(files['0'].path);
		if ( extension === '.ts' ) {
			readTypeFile(file.path, dest, compileType);
		} else {
			changeInfoText("File was not a TypeScript file.");
		};
	} else if ( files.length > 1 ) {
		var typeFiles = [];
		_.forEach(files, function(n, key) {
			if ( path.extname(files[key].path) === '.ts' ) {
				typeFiles.push(files[key].path);
			}
		});
		readManyTypeFiles(typeFiles, dest, compileType);
	};
	return false;
};

function changeInfoText (text) {
	$('#info').text(text);
};

function getDestination (src) {
	var dest;
	if ( options.compile.sameFolder ) {
		dest = path.dirname(src) + '/';
	}
	else if ( options.compile.jsFolder ) {
		dest = path.dirname(path.dirname(src)) + '/js/';
	}
	else if ( options.compile.chooseFolder.enabled ) {
		dest = options.compile.chooseFolder.directory + '/';
	}
	return dest;
};

function minifyJs (fileName, js, dest) {
	var minifiedJs = uglifyjs.minify(js, {fromString: true});
	fs.writeFile(dest + fileName + '.min.js', minifiedJs.code, function(err) {
		if (err) throw err;
		compileEnd(fileName);
	});
};

function compileEnd (fileName) {
	console.log("Saved " + fileName + '.js successfully!');
	end = +new Date();
	var compileTime = end - start;
	changeInfoText("Compiled " + fileName + '.js in ' + compileTime + 'ms');
};

function compileFileEnd (fileName) {
	currentFile += 1;
};

function compileType (typeStr, fileName, dest , many) {
	var js = tsc.compileString(typeStr);
	fs.writeFile(dest + fileName + '.js', js, function (err) {
		if (err) {
			changeInfoText('Directory does not exist');
			throw err;
		}

		if(options.js.minify) {
			minifyJs(fileName, js, dest);
			return;
		}

		compileEnd(fileName);
	});
};

function readTypeFile (src, dest, callback) {
	var fileName = path.basename(src, '.ts');
	fs.readFile(src, 'utf8', function (err, data) {
		if (err) throw err;
		callback(data, fileName, dest);
	});
};

function readManyTypeFiles (array, dest, callback) {
	array.forEach(function (filePath) {
		var fileName = path.basename(filePath, '.ts');
		fs.readFile(filePath, 'utf8', function (err, data) {
			if (err) throw err;
			callback(data, fileName, dest, true);
		});
	});
};

function fileDialogClicked (obj) {
	var clickedId = obj.attr('id');
	ipc.send('open-dialog', clickedId);
};

function compileOptionClicked (obj) {
	var clickedId = obj.attr('id');
	var selectArray = [];
	$('#compileOptions div').removeClass('selected');
	obj.addClass('selected');
	selectArray.push('compile', clickedId);
	selectOption(selectArray);
};

function jsOptionClicked (obj) {
	var clickedId = obj.attr('id');
	var selectArray = [];
	if (obj.hasClass('selected')) {
		obj.removeClass('selected');
	} else {
		obj.addClass('selected');
	}

	selectArray.push('js', clickedId);
	selectOption(selectArray);
};

function watchOptionClicked (obj) {
	var clickedId = obj.attr('id');
	var selectArray = [];
	var option = $('#watchOptions div');

	if ( option.hasClass('selected') ){
		option.removeClass('selected');
	} else {
		option.addClass('selected');
	}

	selectArray.push('watch', clickedId);
	selectOption(selectArray);
};

function selectOption (array) {
	console.log(array[0]);
	if ( array[0] === 'compile' ) {
		options.compile.sameFolder = 			false;
		options.compile.jsFolder = 				false;
		options.compile.chooseFolder.enabled = 	false;
		if( array[1] === 'chooseFolder') {
			options.compile.chooseFolder.enabled = true;
		} else {
			options.compile[array[1]] = true;
		}
	} else if ( array[0] === 'watch') {
		if ( $('#' + array[1]).hasClass('selected') ) {
			options.watch.enabled = true;
		} else {
			options.watch.enabled = false;
		}
	} else if ( array[0] === 'js' ) {
		if ( $('#' + array[1]).hasClass('selected') ) {
			if ( array[1] === 'minifyJs' ) {
				options.js.minify = true;
			} 
		} else {
			if ( array[1] === 'minifyJs' ) {
				options.js.minify = false;
			} 
		}
	}
	if (options.watch.enabled === false) {
		try {
			gaze.close();
		} catch (err) {
			if (err) throw err;
		}
	} else {
		watchDirectory(options.watch.enabled);
	}
	writeOptionsToFile();
};

$('#chooseFolder, #watchFolder').on('click', function (e) {
	if ( !$(this).hasClass('selected') ) {
		fileDialogClicked($(this));
	}
});

$('#sameFolder, #jsFolder, #chooseFolder').on('click', function (e) {
	compileOptionClicked($(this));
});

$('#watchFolder').on('click', function (e) {
	watchOptionClicked($(this));
});

$('#minifyJs').on('click', function (e) {
	jsOptionClicked($(this));
});

ipc.on('open-dialog-reply', function (arg) {
	console.log(arg[1]);
	if ( arg[1] === 'watchFolder' ) {
		options.watch.directory = arg[0].toString();
		if (options.watch.enabled) {
			watchDirectory(true);
		}
	} else if ( arg[1] === 'chooseFolder' ) {
		options.compile.chooseFolder.directory = arg[0].toString();
	}
	$('#' + arg[1]).children('.directoryBox').text(arg[0]);
	writeOptionsToFile();
});


// SAVING AND READING OPTIONS

// Options placeholder if the file doesn't exist
var options = {
	compile: {
		sameFolder: 	true,
		jsFolder: 		false,
		chooseFolder: {
			enabled: 	false,
			directory: 	null
		} 
	},
	watch: {
		enabled: 		false,
		directory: 		null 
	},
	js: {
		minify: 		false
	}
};

readOptionsFromFile();


function writeOptionsToFile (callback) {
	fs.writeFile(__dirname + '/options.json', JSON.stringify(options, null, 4), function (err) {
		if (err) throw err;
		console.log("Wrote options to file.");
		if (callback) callback();
	});
};

function readOptionsFromFile () {
	fs.readFile(__dirname + '/options.json', 'utf8', function (err, data) {
		if (err) {
			writeOptionsToFile(selectOptionsFromFile);
		};
		options = JSON.parse(data);
		selectOptionsFromFile();
		watchDirectory(options.watch.enabled);
	});
};

function selectOptionsFromFile () {
	var filesToSelect = [];

	if ( options.compile.sameFolder ) {
		filesToSelect.push('#sameFolder');
	} else if ( options.compile.jsFolder ) {
		filesToSelect.push('#jsFolder');
	} else if ( options.compile.chooseFolder.enabled ) {
		filesToSelect.push('#chooseFolder');
		$('#chooseFolder .directoryBox').text(options.compile.chooseFolder.directory);
	} 

	if ( options.watch.enabled ) {
		filesToSelect.push('#watchFolder');
		$('#watchFolder .directoryBox').text(options.watch.directory);
	};

	if ( options.js.minify ) {
		filesToSelect.push('#minifyJs');
	}

	selectOptions(filesToSelect);
};

function selectOptions (array) {
	$.each(array, function (index, value) {
		var item = value;
		$(item).addClass('selected');
	});
};
