/* jshint globalstrict: true */
'use strict';

function initWatchVal() { }//Init value for last of watcher
function Scope(){
	//'$$' indicates using internally.
	this.$$watchers = [];
	//record last dirty watch to optimize digest.
	this.$$lastDirtyWatch = null;
	//schedule async jobs
	this.$$asyncQueue = [];
	this.$$applyAsyncQueue = [];
	//keep track of the timeout schedule of applyAsync queue draining.
	this.$$applyAsyncId = null;
	this.$$postDigestQueue = [];
	this.$$phase = null;
	this.$$children = [];
	this.$root = this;

}

Scope.prototype.$beginPhase = function(phase){
	if(this.$$phase){
		throw this.$$phase + ' already in progress.';
	}
	this.$$phase = phase;
};

Scope.prototype.$clearPhase = function(){
	this.$$phase = null;
};

Scope.prototype.$$flushApplyAsync = function(){
	while(this.$$applyAsyncQueue.length){
		try{
			this.$$applyAsyncQueue.shift()();
		}catch(e){
			console.error(e);
		}
	}
	this.$$applyAsyncId = null;
};

Scope.prototype.$$postDigest = function(fn){
	try{
		this.$$postDigestQueue.push(fn);
	}catch(e){
		console.error(e);
	}
};

Scope.prototype.$applyAsync = function(expr){
	var self = this;
	self.$$applyAsyncQueue.push(function(){
		self.$eval(expr);
	});

    if(self.$$applyAsyncId === null){//not yet schedule, optimize digest process.
    	self.$$applyAsyncId = setTimeout(function(){
			self.$apply(_.bind(self.$$flushApplyAsync, self));
		}, 0);//execute in the next round.
    }
	
};

Scope.prototype.$evalAsync = function(expr){
	//store the scope is used for scope inheritance.
	var self  = this;
	if(!self.$$phase && !self.$$asyncQueue.length){
		setTimeout(function(){
			if(self.$$asyncQueue.length){
				self.$root.$digest();
			}
		}, 0);
	}
	this.$$asyncQueue.push({scope: this, expression: expr});
};

Scope.prototype.$$areEqual = function(newValue, oldValue, valueEq){
	if(valueEq){
		return _.isEqual(newValue, oldValue);
	} else {
		return newValue === oldValue || (typeof newValue === 'number' && typeof oldValue === 'number' && 
			isNaN(newValue) && isNaN(oldValue));
	}
};

Scope.prototype.$eval = function(expr, locals){
	return expr(this, locals);
};

Scope.prototype.$apply = function(expr){
	try{
		this.$beginPhase("$apply");
		return this.$eval(expr);
	} finally{
		this.$clearPhase();
		this.$root.$digest();//always execute.
	}
};

Scope.prototype.$watchGroup = function(watchFns, listenerFn){
	var self = this;
	var newValues = new Array(watchFns.length);
	var oldValues = new Array(watchFns.length); 

	var changeReactionScheduled = false;
	var firstRun = true;

	if(watchFns.length === 0){
		var shouldCall = true;
		self.$evalAsync(function(){
			if(shouldCall){
				listenerFn(newValues, newValues, self);//call listener exactly once.
			}
		});
		return function(){
			shouldCall = false;
		};
	}

	function watchGroupListener() {
		if(firstRun){
			firstRun = false;
			listenerFn(newValues, newValues, self);
		}else{
			listenerFn(newValues, oldValues, self);
		}
		changeReactionScheduled = false;
	}
	var destroyFunctions = _.map(watchFns, function(watchFn, i){
		return self.$watch(watchFn, function(newValue, oldValue){
			newValues[i] = newValue;
			oldValues[i] = oldValue;
			if(!changeReactionScheduled){
				changeReactionScheduled = true;//already schedule a listener call
				self.$evalAsync(watchGroupListener);
			}
		});
	});

	return function(){
		_.forEach(destroyFunctions, function(destroyFunction){
			destroyFunction();
		});
	};
};

Scope.prototype.$watch = function(watchFn, listenerFn, valueEq){
	var self = this;
	var watcher = {
		watchFn: watchFn,
		listenerFn: listenerFn || function() {},
		valueEq : !!valueEq,
		last : initWatchVal
	};
	this.$$watchers.unshift(watcher);//add to the head of array instead.
	//whenever there is a new watcher, clear the last dirty because the new one may be added later and dirty.
	this.$root.$$lastDirtyWatch = null;

	return function(){//this is a closure in which the temp variables stays, like watcher.
		var index = self.$$watchers.indexOf(watcher);
		if(index >= 0){
			self.$$watchers.splice(index, 1);
			self.$root.$$lastDirtyWatch = null;//eliminate short-circuiting optimization.
		}
	};
};

Scope.prototype.$$digestOnce = function(){
	var self = this;
	var dirty;
	var continueLoop = true;
	this.$$everyScope(function(scope){
		var newValue, oldValue;
		_.forEachRight(scope.$$watchers, function(watcher){
			try{
				if(watcher){//may be removed by other watcher.
					newValue = watcher.watchFn(scope);
					oldValue = watcher.last;
					if(!scope.$$areEqual(newValue, oldValue, watcher.valueEq)){
						self.$root.$$lastDirtyWatch = watcher;
						watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue);
						watcher.listenerFn(newValue, oldValue === initWatchVal ? newValue : oldValue, scope);
						dirty = true;
					}else if(self.$root.$$lastDirtyWatch === watcher){
						continueLoop = false;
						return false;
					}
				}
			}catch(e){
				console.error(e);
			}
		});
		return continueLoop;
	});
	
	return dirty;
};

Scope.prototype.$digest = function(){
	var ttl = 10;//default of Angular
	var dirty;
	this.$root.$$lastDirtyWatch = null;
	this.$beginPhase("$digest");

	if(this.$$applyAsyncId){//if there is applyAsync func, flush it.
		clearTimeout(this.$$applyAsyncId);
		this.$$flushApplyAsync();
	}

	do {
		while(this.$$asyncQueue.length){
			try{
				var asyncTask = this.$$asyncQueue.shift();
				asyncTask.scope.$eval(asyncTask.expression);
			}catch(e){
				console.error(e);
			}
		}
		//wait for all watchers stable, no value changes.
		dirty = this.$$digestOnce();
		if((dirty || this.$$asyncQueue.length) && !(ttl--)){
			this.$clearPhase();
			throw "10 digest iterations reached";
		}
	}while(dirty || this.$$asyncQueue.length);
	this.$clearPhase();

	while(this.$$postDigestQueue.length){
		this.$$postDigestQueue.shift()();
	}
};

Scope.prototype.$$everyScope = function(fn){
	//use Array.every method because it has return value.(if all items return true, then every returns true)
	if(fn(this)){//current scope
		return this.$$children.every(function(child){
			return child.$$everyScope(fn);
		});
	}else {
		return false;
	}
	
};

Scope.prototype.$new = function(isolated){
	/*var ChildScope = function(){};
	ChildScope.prototype = this;
	var child = new ChildScope();*/
	var child;
	if(isolated){
		child = new Scope();
	}else {
		//HTML5 Object creat method is an alternative.
		child = Object.create(this);
	}
	this.$$children.push(child);
	child.$$watchers = [];
	child.$$children = [];
	return child;
};