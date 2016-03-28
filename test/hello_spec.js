describe("Hello", function(){//describe work as grouping
	it("says hello to receiver", function(){//it defines a case
		expect(sayHello('Cat')).toBe("Hello, Cat!");
	});
});