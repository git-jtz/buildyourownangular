/* jshint globalstrict: true */
'use strict';

function initWatchVal() { }//Init value for last of watcher
function Scope(){
	//'$$' indicates using internally.
	this.$$watchers = [];
	//record last dirty watch to optimize digest.
	this.$$lastDirtyWatch = null;
}

Scope.prototype.$watch = function(watchFn, listenerFn){
	var watcher = {
		watchFn: watchFn,
		listenerFn: listenerFn || function() {},
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
		if(newValue != oldValue){
			self.$$lastDirtyWatch = watcher;
			watcher.last = newValue;
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
	do {
		//wait for all watchers stable, no value changes.
		dirty = this.$$digestOnce();
		if(dirty && !(ttl--)){
			throw "10 digest iterations reached";
		}
	}while(dirty);
};