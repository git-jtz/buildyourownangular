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
	this.$$phase = null;
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

Scope.prototype.$evalAsync = function(expr){
	//store the scope is used for scope inheritance.
	var self  = this;
	if(!self.$$phase && !self.$$asyncQueue.length){
		setTimeout(function(){
			if(self.$$asyncQueue.length){
				self.$digest();
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
		this.$digest();//always execute.
	}
};

Scope.prototype.$watch = function(watchFn, listenerFn, valueEq){
	var watcher = {
		watchFn: watchFn,
		listenerFn: listenerFn || function() {},
		valueEq : !!valueEq,
		last : initWatchVal
	};
	this.$$watchers.push(watcher);
	//whenever there is a new watcher, clear the last dirty because the new one may be added later and dirty.
	this.$$lastDirtyWatch = null;
};

Scope.prototype.$$digestOnce = function(){
	var self = this;
	var newValue, oldValue, dirty;
	_.forEach(this.$$watchers, function(watcher){
		newValue = watcher.watchFn(self);
		oldValue = watcher.last;
		if(!self.$$areEqual(newValue, oldValue, watcher.valueEq)){
			self.$$lastDirtyWatch = watcher;
			watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue);
			watcher.listenerFn(newValue, oldValue === initWatchVal ? newValue : oldValue, self);
			dirty = true;
		}else if(self.$$lastDirtyWatch === watcher){
			return false;
		}
	});
	return dirty;
};

Scope.prototype.$digest = function(){
	var ttl = 10;//default of Angular
	var dirty;
	this.$$lastDirtyWatch = null;
	this.$beginPhase("$digest");
	do {
		while(this.$$asyncQueue.length){
			var asyncTask = this.$$asyncQueue.shift();
			asyncTask.scope.$eval(asyncTask.expression);
		}
		//wait for all watchers stable, no value changes.
		dirty = this.$$digestOnce();
		if((dirty || this.$$asyncQueue.length) && !(ttl--)){
			this.$clearPhase();
			throw "10 digest iterations reached";
		}
	}while(dirty || this.$$asyncQueue.length);
	this.$clearPhase();
};