import 'reflect-metadata';
import { Exclude, Expose, Type } from '../../src/decorators';
import {
  classToPlainFromExist,
  instanceToInstance,
  instanceToPlain,
  plainToInstance,
} from '../../src/index';
import { defaultMetadataStorage } from '../../src/storage';

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

  // TODO: test other custom functionality
});
