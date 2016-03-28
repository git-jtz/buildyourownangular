/* jshint globalstrict: true */
/* global Scope: false */
'use strict';

describe("Scope", function(){//describe work as grouping
	it("can be constructed and used as an object", function(){//it defines a case
		var scope = new Scope();
		scope.aProperty = 1;
		expect(scope.aProperty).toBe(1);
	});
	
	describe("digest", function(){
		var scope;
		beforeEach(function(){
			scope = new Scope();
		});
		
		it("calls the listener function of a watch on first $digest", function(){
			var watchFn = function(){
				return 'wat';
			};
			var listenerFn = jasmine.createSpy();
			scope.$watch(watchFn, listenerFn);
			scope.$digest();
			expect(listenerFn).toHaveBeenCalled();
		});
		
		it("calls the watch function with scope as argument", function(){
			var watchFn = jasmine.createSpy();
			var listenerFn = function(){};
			scope.$watch(watchFn, listenerFn);
			scope.$digest();
			expect(watchFn).toHaveBeenCalledWith(scope);
		});
		
		it("calls the listener function when the watched value changes", function(){
			scope.someValue = 'a';
			scope.counter = 0;
			
			scope.$watch(
				function(scope){return scope.someValue;},
				function(newValue, oldValue, scope){scope.counter++;}
			);
			
			expect(scope.counter).toBe(0);
			
			scope.$digest();
			expect(scope.counter).toBe(1);
			
			scope.$digest();
			expect(scope.counter).toBe(1);
			
			scope.someValue = 'b';
			expect(scope.counter).toBe(1);
			
			scope.$digest();
			expect(scope.counter).toBe(2);
		});
		
		it("calls the listener function when the watched last value undefined", function(){
			scope.counter = 0;
			scope.$watch(
				function(scope) { return scope.someValue; },//undefined, as last
				function(newValue, oldValue, scope) { scope.counter++; }
			);
			
			scope.$digest();
			expect(scope.counter).toBe(1);
		});
		
		it("calls listener with new value as old value the first time", function() {
			scope.someValue = 123;
			var oldGivenValue;
			
			scope.$watch(
				function(scope) { return scope.someValue; },
				function(newValue, oldValue, scope) { oldGivenValue = oldValue; }
			);
			
			//for the first time digest, old value should be the same with new value. It's not good to set old value as a function reference
			scope.$digest();
			expect(oldGivenValue).toBe(123);
		});
		
		it("may have watchers that omit the listener function", function() {
			//only use watch function to be notified the digest is in progress.
			//usually return nothing for watchFn, after the first digest the last value of watcher is undefined, and will not change.
			var watchFn = jasmine.createSpy().and.returnValue('sth');
			scope.$watch(watchFn);
			
			scope.$digest();
			expect(watchFn).toHaveBeenCalled();
		});
		
		it("triggers chained watchers in the same digest", function() {
			scope.name = 'july';
			
			scope.$watch(
				function(scope){ return scope.nameUpper;},
				function(newValue, oldValue, scope){
					if(newValue){
						//another data change in the same digest pass
						scope.initial = newValue.substring(0, 1) + '.';
					}
				}
			);
			
			scope.$watch(
				function(scope){ return scope.name;},
				function(newValue, oldValue, scope){
					if(newValue){
						//another data change in the same digest pass
						scope.nameUpper = newValue.toUpperCase();
					}
				}
			);
			
			scope.$digest();
			expect(scope.initial).toBe('J.');
			
			scope.name = 'cat';
			scope.$digest();
			expect(scope.initial).toBe('C.');
		});
	});
});