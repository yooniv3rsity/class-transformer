import 'reflect-metadata';
import { Exclude, Expose, Type, Structure } from '../../src/decorators';
import {
	classToPlainFromExist,
	instanceToInstance,
	instanceToPlain,
	plainToInstance,
} from '../../src/index';
import { defaultMetadataStorage } from '../../src/storage';

const strictConfig = {excludeExtraneousValues:true};

describe('functionality implemented by YOOniversity', () => {

	it('should allow to pass a different default strategy for subobjects', () => {
		defaultMetadataStorage.clear();
		
		interface UserData {
			prop1: string;
		}
		
		class User {
			@Expose()
			name: string;
			
			@Expose()
			data: UserData;
		}
		
		const user = new User();
		user.name = 'Umed';
		user.data = { prop1: 'random' };
		
		const fromExistUser = new User();
		fromExistUser.name = 'exist';
		
		const plainUser: any = instanceToPlain(user, { strategy: 'excludeAll' });
		expect(plainUser).toEqual({
			name: 'Umed',
			data: {},
		});
		expect(plainUser.data.prop1).toBeUndefined();
		
		const plainUser2: any = instanceToPlain(user, {
			strategy: 'excludeAll',
			nestedStrategy: 'exposeAll',
		});
		expect(plainUser2.data.prop1).toEqual('random');
		
		const existUser = { data: { prop1: 'test' } };
		// for unknown reasons, data will equal prop1:'test' here
		// const plainUser3 = classToPlainFromExist(user, existUser, { strategy: "excludeAll" });
		// plainUser3.should.be.eql({
		// 	name: "Umed",
		// 	data: {}
		// });
		const plainUser4: { [k: string]: any } = classToPlainFromExist(
			user,
			existUser,
			{
				strategy: 'excludeAll',
				nestedStrategy: 'exposeAll',
			}
		);
		expect(plainUser4).toEqual({
			name: 'Umed',
			data: { prop1: 'random' },
		});
		
		const plainUser5 = classToPlainFromExist(user, existUser, {
			strategy: 'exposeAll',
			nestedStrategy: 'exposeAll',
		});
		expect(plainUser5).toEqual({
			name: 'Umed',
			data: { prop1: 'random' },
		});
		// const plainUser6:{[k:string]:any} = classToPlainFromExist(user, existUser, { strategy: "exposeAll", nestedStrategy:"excludeAll" });
		// plainUser6.should.be.eql({
		// 	name: "Umed",
		// 	data: {prop1:'random'}
		// });
		
		const fromPlainUser = {
			data: { prop1: 'random' },
		};
		
		const transformedUser = plainToInstance(User, fromPlainUser, {
			strategy: 'excludeAll',
			nestedStrategy: 'exposeAll',
		});
		expect(transformedUser).toBeInstanceOf(User);
		expect(transformedUser).toEqual({
			name: undefined,
			data: { prop1: 'random' },
		});
		
		// const fromExistTransformedUser = plainToClassFromExist(fromExistUser, fromPlainUser, { strategy: "excludeAll", nestedStrategy:"exposeAll" });
		// fromExistTransformedUser.should.be.instanceOf(User);
		// fromExistTransformedUser.should.be.eql({
		// 	name: "exist",
		// 	data: {prop1:"random"}
		// });
		
		const instanceToInstanceUser = instanceToInstance(user, {
			strategy: 'excludeAll',
			nestedStrategy: 'exposeAll',
		});
		expect(instanceToInstanceUser).toBeInstanceOf(User);
		expect(instanceToInstanceUser).toEqual(user);
		expect(instanceToInstanceUser).toEqual({
			name: 'Umed',
			data: { prop1: 'random' },
		});
	});

	describe('@Structure', () => {
		it('Array should work - with object', () => {

			class UserData {
				@Expose()
				value:string;
			}
			class User {
				@Expose()
				name: string;
				
				@Expose()
				@Structure(Array,()=>UserData)
				data: UserData[];
			}

			// populate empty
			const test1 = plainToInstance(User, {
				name: 'yoo',
				data: []
			}, strictConfig);
			expect(test1).toEqual({
				name: 'yoo',
				data: [],
			});
			expect(instanceToPlain(test1, strictConfig)).toEqual({
				name: 'yoo',
				data: [],
			});

			// skip
			const test2 = plainToInstance(User, {
				name: 'yoo'
			}, strictConfig);
			expect(test2).toEqual({
				name: 'yoo'
			});
			expect(instanceToPlain(test2, strictConfig)).toEqual({
				name: 'yoo',
			});

			// populate data from plain
			const test3 = plainToInstance(User, {
				name: 'yoo',
				data: [{ value: 'abc' }, { value: 'def' },]
			}, strictConfig);
			expect(test3).toEqual({
				name: 'yoo',
				data: [{value:'abc'},{value:'def'},],
			});
			expect(instanceToPlain(test3, strictConfig)).toEqual({
				name: 'yoo',
				data: [{value:'abc'}, {value:'def'}],
			});

			// ignore incoming data if of incorrect type
			const test4 = plainToInstance(User, {
				name: 'yoo',
				data: { value: 'abc' },
			}, strictConfig);
			expect(test4).toEqual({
				name: 'yoo',
				data: [],
			});
			test4.data = {foo:'bar'} as any;
			expect(instanceToPlain(test4, strictConfig)).toEqual({
				name: 'yoo',
				data: [],
			});

			// nested type works
			const test5 = plainToInstance(User, {
				name: 'yoo',
				data: [{ value: 'abc' }, { name: 'def' },]
			}, strictConfig);
			expect(test5).toEqual({
				name: 'yoo',
				data: [{value:'abc'},{},],
			});
			test5.data[1] = 'bsf' as any;
			expect(instanceToPlain(test5, strictConfig)).toEqual({
				name: 'yoo',
				data: [{value:'abc'}, {}],
			});

		})
		it('Array should work - with primitive', () => {

			class User {
				@Expose()
				name: string;
				
				@Expose()
				@Structure(Array,()=>String)
				data: string[];
			}

			// populate empty
			const test1 = plainToInstance(User, {
				name: 'yoo',
				data: []
			}, strictConfig);
			expect(test1).toEqual({
				name: 'yoo',
				data: [],
			});
			expect(instanceToPlain(test1, strictConfig)).toEqual({
				name: 'yoo',
				data: [],
			});

			// skip
			const test2 = plainToInstance(User, {
				name: 'yoo'
			}, strictConfig);
			expect(test2).toEqual({
				name: 'yoo'
			});
			expect(instanceToPlain(test2, strictConfig)).toEqual({
				name: 'yoo',
			});

			// populate data from plain
			const test3 = plainToInstance(User, {
				name: 'yoo',
				data: ['foo', 'bar']
			}, strictConfig);
			expect(test3).toEqual({
				name: 'yoo',
				data:['foo','bar']
			});
			expect(instanceToPlain(test3, strictConfig)).toEqual({
				name: 'yoo',
				data: ['foo','bar'],
			});
	
			// ignore incoming data if of incorrect type
			const test4 = plainToInstance(User, {
				name: 'yoo',
				data: { 'foo': 'bar' }
			}, strictConfig);
			expect(test4).toEqual({
				name: 'yoo',
				data: [],
			});
			test4.data = {foo:'bar'} as any;
			expect(instanceToPlain(test4, strictConfig)).toEqual({
				name: 'yoo',
				data: [],
			});

			const test5 = plainToInstance(User, {
				name: 'yoo',
				data: ['foo', 333]
			}, strictConfig);
			// nested type works
			expect(test5).toEqual({
				name: 'yoo',
				data: ['foo','333'],
			});
			test5.data = ['foo',123] as any;
			expect(instanceToPlain(test5, strictConfig)).toEqual({
				name: 'yoo',
				data: ['foo','123'],
			});

		})

		it('Set should work - with object', () => {

			class UserData {
				@Expose()
				value:string;
			}
			class User {
				@Expose()
				name: string;
				
				@Expose()
				@Structure(Set,()=>UserData)
				data: Set<UserData>;
			}

			// populate empty
			const test1 = plainToInstance(User, {
				name: 'yoo',
				data: []
			}, strictConfig);
			expect(test1.data).toBeInstanceOf(Set)
			expect(test1.data.size).toBe(0)
			expect(instanceToPlain(test1, strictConfig)).toEqual({
				name: 'yoo',
				data: [],
			});

			// skip
			const test2 = plainToInstance(User, {
				name: 'yoo',
			}, strictConfig);
			expect(test2.data).toBeUndefined()
			expect(instanceToPlain(test2, strictConfig)).toEqual({
				name: 'yoo',
			});

			// populate data from plain
			const test3 = plainToInstance(User, {
				name: 'yoo',
				data:[{value:'abc'},{value:'def'},]
			}, strictConfig);
			expect(test3.data).toBeInstanceOf(Set)
			expect(test3.data.size).toBe(2)
			expect(test3.data).toEqual(new Set([{value:'abc'},{value:'def'},]))
			expect(instanceToPlain(test3, strictConfig)).toEqual({
				name: 'yoo',
				data: [{value:'abc'},{value:'def'}]
			});
			
			// ignore incoming data if of incorrect type
			const test4 = plainToInstance(User, {
				name: 'yoo',
				data:{value:'abc'}
			}, strictConfig);
			expect(test4.data).toBeInstanceOf(Set)
			expect(test4.data.size).toBe(0)
			test4.data = {test:123} as any;
			expect(instanceToPlain(test4, strictConfig)).toEqual({
				name: 'yoo',
				data: []
			});

			// nested type works
			const test5 = plainToInstance(User, {
				name: 'yoo',
				data:[{value:'abc'},{value:"123",test:123},]
			}, strictConfig);
			expect(test5.data).toBeInstanceOf(Set)
			expect(test5.data.size).toBe(2)
			expect(test5.data).toEqual(new Set([{value:'abc'},{value:"123"},]))
			expect(instanceToPlain(test5, strictConfig)).toEqual({
				name: 'yoo',
				data: [{value:'abc'},{value:'123'}]
			});
	
		})

		it('Set should work - with primitive', () => {

			class User {
				@Expose()
				name: string;
				
				@Expose()
				@Structure(Set,()=>String)
				data: Set<string>;
			}

			// populate empty
			const test1 = plainToInstance(User, {
				name: 'yoo',
				data: []
			}, strictConfig);
			expect(test1.data).toBeInstanceOf(Set);
			expect(test1.data.size).toBe(0);
			expect(instanceToPlain(test1, strictConfig)).toEqual({
				name: 'yoo',
				data: [],
			});

			// skip
			const test2 = plainToInstance(User, {
				name: 'yoo'
			}, strictConfig);
			expect(test2.data).toBeUndefined();
			expect(instanceToPlain(test2, strictConfig)).toEqual({
				name: 'yoo',
			});

			// populate data from plain
			const test3 = plainToInstance(User, {
				name: 'yoo',
				data: ['foo', 'bar']
			}, strictConfig);
			expect(test3).toEqual({
				name: 'yoo',
				data:new Set(['foo','bar'])
			});
			expect(instanceToPlain(test3, strictConfig)).toEqual({
				name: 'yoo',
				data: ['foo','bar'],
			});
	
			// ignore incoming data if of incorrect type
			const test4 = plainToInstance(User, {
				name: 'yoo',
				data: { 'foo': 'bar' }
			}, strictConfig);
			expect(test4).toEqual({
				name: 'yoo',
				data: new Set([]),
			});
			test4.data = {foo:'bar'} as any;
			expect(instanceToPlain(test4, strictConfig)).toEqual({
				name: 'yoo',
				data: [],
			});

			// nested type works
			const test5 = plainToInstance(User, {
				name: 'yoo',
				data: ['foo', 333]
			}, strictConfig);
			expect(test5).toEqual({
				name: 'yoo',
				data: new Set(['foo','333']),
			});
			test5.data = ['foo',123] as any;
			expect(instanceToPlain(test5, strictConfig)).toEqual({
				name: 'yoo',
				data: ['foo','123'],
			});

		})


		it('Map should work - with object', () => {

			class UserData {
				@Expose()
				value:string;
			}
			class User {
				@Expose()
				name: string;
				
				@Expose()
				@Structure(Map,()=>UserData)
				data: Map<string,UserData>;
			}

			// populate empty
			const test1 = plainToInstance(User, {
				name: 'yoo',
				data: {}
			}, strictConfig);
			expect(test1.data).toBeInstanceOf(Map)
			expect(test1.data.size).toBe(0)
			expect(instanceToPlain(test1, strictConfig)).toEqual({
				name: 'yoo',
				data: {},
			});

			// skip
			const test2 = plainToInstance(User, {
				name: 'yoo',
			}, strictConfig);
			expect(test2.data).toBeUndefined()
			expect(instanceToPlain(test2, strictConfig)).toEqual({
				name: 'yoo',
			});

			// populate data from plain
			const test3 = plainToInstance(User, {
				name: 'yoo',
				data:{'foo':{value:'abc'},'bar':{value:'def'}}
			}, strictConfig);
			expect(test3.data).toBeInstanceOf(Map)
			expect(test3.data.size).toBe(2)
			expect(test3.data).toEqual(new Map([['foo',{value:'abc'}],['bar',{value:'def'}]]))
			expect(instanceToPlain(test3, strictConfig)).toEqual({
				name: 'yoo',
				data:{'foo':{value:'abc'},'bar':{value:'def'}}
			});
			
			// ignore incoming data if of incorrect type
			// NOTE: Behavior is not ideal, but in plain state object and map are identical, 
			// so theres no possiblity to distinguish them
			const test4 = plainToInstance(User, {
				name: 'yoo',
				data:{value:'abc'}
			}, strictConfig);
			expect(test4.data).toBeInstanceOf(Map)
			expect(test4.data.size).toBe(1)
			expect(test4.data).toEqual(new Map([['value',{}]]))
			test4.data = {test:123} as any;
			expect(instanceToPlain(test4, strictConfig)).toEqual({
				name: 'yoo',
				data: {test:{}}
			});

			// nested type works
			const test5 = plainToInstance(User, {
				name: 'yoo',
				data:{'foo':{value:'abc'},'bar':{value:'def',test:11}}
			}, strictConfig);
			expect(test5.data).toBeInstanceOf(Map)
			expect(test5.data.size).toBe(2)
			expect(test5.data).toEqual(new Map([['foo',{value:'abc'}],['bar',{value:'def'}]]))
			expect(instanceToPlain(test5, strictConfig)).toEqual({
				name: 'yoo',
				data:{'foo':{value:'abc'},'bar':{value:'def'}}
			});
	
		})

		it('Map should work - with primitive', () => {

			class User {
				@Expose()
				name: string;
				
				@Expose()
				@Structure(Map,()=>String)
				data: Map<string,string>;
			}

			// populate empty
			const test1 = plainToInstance(User, {
				name: 'yoo',
				data: {}
			}, strictConfig);
			expect(test1.data).toBeInstanceOf(Map);
			expect(test1.data.size).toBe(0);
			expect(instanceToPlain(test1, strictConfig)).toEqual({
				name: 'yoo',
				data: {},
			});

			// skip
			const test2 = plainToInstance(User, {
				name: 'yoo'
			}, strictConfig);
			expect(test2.data).toBeUndefined();
			expect(instanceToPlain(test2, strictConfig)).toEqual({
				name: 'yoo',
			});

			// populate data from plain
			const test3 = plainToInstance(User, {
				name: 'yoo',
				data: {'foo':'abc','bar':'def'}
			}, strictConfig);
			expect(test3).toEqual({
				name: 'yoo',
				data:new Map([['foo','abc'],['bar','def']])
			});
			expect(instanceToPlain(test3, strictConfig)).toEqual({
				name: 'yoo',
				data: {'foo':'abc','bar':'def'},
			});
	
			// ignore incoming data if of incorrect type
			const test4 = plainToInstance(User, {
				name: 'yoo',
				data: ['foo','bar']
			}, strictConfig);
			expect(test4).toEqual({
				name: 'yoo',
				data: new Map(),
			});
			test4.data = [{foo:'bar'}] as any;
			expect(instanceToPlain(test4, strictConfig)).toEqual({
				name: 'yoo',
				data: {},
			});

			// nested type works
			const test5 = plainToInstance(User, {
				name: 'yoo',
				data: {foo:'test',bar:123}
			}, strictConfig);
			expect(test5).toEqual({
				name: 'yoo',
				data: new Map([['foo','test'], ['bar','123']]),
			});
			test5.data = new Map<string,any>([['foo','test'], ['bar',123]]);
			expect(instanceToPlain(test5, strictConfig)).toEqual({
				name: 'yoo',
				data: {foo:'test',bar:'123'},
			});

		})

	})
	
	// TODO: test other custom functionality
});
