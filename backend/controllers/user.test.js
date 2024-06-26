jest.mock("passport");
jest.mock("bcrypt");
jest.mock("../models");

const passport = require("passport");
const bcrypt = require("bcrypt");

const { sequelize, User } = require("../models");
const { getUserInfo, join, login, modifyUserInfo, logout, deleteUserInfo } = require("./user");

sequelize.transaction.mockReturnValue(Promise.resolve({
    commit: jest.fn(() => Promise.resolve(true)),
    rollback: jest.fn(() => Promise.resolve(true)),
}));

// [u-01] 회원 정보 조회
describe("[u-01] getUserInfo", () => {
    const user = {
        userId: "yush1nk1m",
        email: "yush1nk1m@github.com",
        nickname: "유신",
    };
    const res = {
        status: jest.fn(() => res),
        json: jest.fn(),
    };
    const next = jest.fn();
    
    test("[uut-01-1] 회원 정보를 조회하면 사용자의 ID, 이메일, 닉네임을 응답한다.", () => {
        const req = {
            user,
        };
        
        getUserInfo(req, res);
        
        expect(res.status).toBeCalledWith(200);
        expect(res.json).toBeCalledWith(user);
    });

    test("[uut-01-2] 요청 객체가 손실되면 회원 정보 조회에 실패하고 에러가 발생한다.", () => {
        const req = {};

        getUserInfo(req, res, next);

        expect(next).toBeCalledTimes(1);
    });
});

// [u-02] 회원 가입
describe("[u-02] join", () => {
    let req = {
        body: {
            userId: "yush1nk1m",
            email: "yush1nk1m@github.com",
            nickname: "유신",
            password: "12345",
            confirmPassword: "12345",
        }
    };
    const res = {
        status: jest.fn(() => res),
        send: jest.fn(),
    };
    const next = jest.fn();
    
    User.create.mockReturnValue(Promise.resolve(true));

    test("[uut-02-1] 같은 ID를 가진 사용자가 존재하지 않으면 회원 가입에 성공한다.", async () => {
        User.findOne.mockReturnValue(Promise.resolve(false));

        await join(req, res, next);

        expect(res.status).toBeCalledWith(200);
        expect(res.send).toBeCalledWith("회원 가입에 성공했습니다.");
    });

    test("[uut-02-2] 비밀번호와 확인 비밀번호가 일치하지 않을 경우 회원 가입에 실패한다.", async () => {
        req.body.confirmPassword = "54321";

        await join(req, res, next);

        req.body.confirmPassword = "12345";

        expect(res.status).toBeCalledWith(400);
        expect(res.send).toBeCalledWith("비밀번호와 확인 비밀번호가 일치하지 않습니다.");
    });

    test("[uut-02-3] 같은 ID를 가진 사용자가 존재할 경우 회원 가입에 실패한다.", async () => {
        User.findOne.mockReturnValue(Promise.resolve(true));

        await join(req, res, next);

        expect(res.status).toBeCalledWith(409);
        expect(res.send).toBeCalledWith("이미 존재하는 회원 ID입니다.");
    });

    test("[uut-02-4] 데이터베이스 작업 중 에러가 발생하면 next(error)를 호출한다.", async () => {
        const error = new Error("데이터베이스 에러가 발생하였습니다.");
        User.findOne.mockReturnValue(Promise.reject(error));

        await join(req, res, next);

        expect(next).toBeCalledWith(error);
    });
});

// [u-03] 로그인
describe("[u-03] login", () => {
    const res = {
        status: jest.fn(() => res),
        send: jest.fn(),
    };
    const next = jest.fn();
    
    test("[uut-03-1] 인증 및 로그인 과정에 에러가 없고, 사용자 정보가 존재하면 로그인에 성공한다.", () => {
        const req = {
            login: jest.fn((null, jest.fn((user, callback) => {
                callback(false);
            }))),
        }
        passport.authenticate.mockImplementation((strategy, callback) => 
            (req, res, next) => callback(null, true, {})
        );

        login(req, res, next);

        expect(res.status).toBeCalledWith(200);
        expect(res.send).toBeCalledWith("로그인에 성공했습니다.");
    });

    test("[uut-03-2] 로그인 에러가 발생하면 next(loginError)가 호출된다.", () => {
        const loginError = new Error("로그인 중 에러가 발생했습니다.");
        const req = {
            login: jest.fn((null, jest.fn((user, callback) => {
                callback(loginError);
            }))),
        }
        passport.authenticate.mockImplementation((strategy, callback) => 
            (req, res, next) => callback(null, true, {})
        );

        login(req, res, next);

        expect(next).toBeCalledWith(loginError);
    });

    test("[uut-03-3] 사용자 정보가 일치하지 않으면 로그인에 실패한다.", () => {
        const req = {
            login: jest.fn(),
        };
        passport.authenticate.mockImplementation((strategy, callback) => 
            (req, res, next) => callback(null, false, {})
        );

        login(req, res, next);

        expect(res.status).toBeCalledWith(400);
        expect(res.send).toBeCalledWith("사용자 정보가 일치하지 않습니다.");
        expect(req.login).toBeCalledTimes(0);
    });

    test("[uut-03-4] 인증 에러가 발생하면 로그인에 실패한다.", () => {
        const authError = new Error("인증 에러가 발생했습니다.");
        const req = {
            login: jest.fn(),
        };
        passport.authenticate.mockImplementation((strategy, callback) => 
            (req, res, next) => callback(authError, true, {})
        );

        login(req, res, next);

        expect(next).toBeCalledWith(authError);
        expect(req.login).toBeCalledTimes(0);
    });
});

// [u-04] 회원 정보 수정
describe("[u-04] modifyUserInfo", () => {
    const res = {
        status: jest.fn(() => res),
        send: jest.fn(),
    };
    const next = jest.fn();

    test("[uut-04-1] 오류가 발생하지 않고, 비밀번호가 일치하며 변경될 정보가 있으면 회원 정보를 수정한다.", async () => {
        const req = {
            user: {
                userId: "kys",
                nickname: "yushin",
            },
            body: {
                newNickname: "newYushin",
                newPassword: "54321",
                newConfirmPassword: "54321",
                password: "12345",
            },
        };

        bcrypt.compare.mockReturnValue(Promise.resolve(true));
        User.findOne.mockReturnValue({
            save: jest.fn(() => Promise.resolve()),
        });
        bcrypt.hash.mockReturnValue(Promise.resolve(true));


        await modifyUserInfo(req, res, next);

        expect(res.status).toBeCalledWith(200);
        expect(res.send).toBeCalledWith("회원 정보가 수정되었습니다.");
    });

    test("[uut-04-2] 새로운 비밀번호 해싱 작업 중 에러가 발생하면 next(error)를 호출한다.", async () => {
        const req = {
            user: {
                userId: "kys",
                nickname: "yushin",
            },
            body: {
                newNickname: "newYushin",
                newPassword: "54321",
                newConfirmPassword: "54321",
                password: "12345",
            },
        };

        bcrypt.compare.mockReturnValue(Promise.resolve(true));
        User.findOne.mockReturnValue({
            save: jest.fn(() => Promise.resolve()),
        });

        const error = new Error("비밀번호 해싱 중 에러가 발생하였습니다.");
        bcrypt.hash.mockReturnValue(Promise.reject(error));

        await modifyUserInfo(req, res, next);

        expect(next).toBeCalledWith(error);
    });

    test("[uut-04-3] 현재 비밀번호가 일치하지 않으면 회원 정보 수정에 실패한다.", async () => {
        const req = {
            user: {
                userId: "kys",
                nickname: "yushin",
            },
            body: {
                newNickname: "newYushin",
                newPassword: "54321",
                newConfirmPassword: "54321",
                password: "12345",
            },
        };

        bcrypt.compare.mockReturnValue(Promise.resolve(false));

        await modifyUserInfo(req, res, next);

        expect(res.status).toBeCalledWith(400);
        expect(res.send).toBeCalledWith("비밀번호가 일치하지 않습니다.");
    });

    test("[uut-04-4] 변경될 정보가 존재하지 않으면 회원 정보 수정에 실패한다.", async () => {
        const req = {
            user: {
                userId: "kys",
                nickname: "yushin",
            },
            body: {
                newNickname: "yushin",
                newPassword: "",
                newConfirmPassword: "",
                password: "12345",
            },
        };

        bcrypt.compare.mockReturnValue(Promise.resolve(true));
        
        await modifyUserInfo(req, res, next);

        expect(res.status).toBeCalledWith(400);
        expect(res.send).toBeCalledWith("변경될 정보가 존재하지 않습니다.");
    });

    test("[uut-04-5] 변경할 비밀번호와 그 확인 비밀번호가 일치하지 않으면 회원 정보 수정에 실패한다.", async () => {
        const req = {
            user: {
                userId: "kys",
                nickname: "yushin",
            },
            body: {
                newNickname: "newYushin",
                newPassword: "newPassword1",
                newConfirmPassword: "newPassword2",
                password: "12345",
            },
        };

        bcrypt.compare.mockReturnValue(Promise.resolve(true));

        await modifyUserInfo(req, res, next);

        expect(res.status).toBeCalledWith(400);
        expect(res.send).toBeCalledWith("변경할 비밀번호와 확인 비밀번호가 일치하지 않습니다.");
    });

    test("[uut-04-6] 데이터베이스 탐색 작업 중 에러 발생 시 next(error)를 호출한다.", async () => {
        const req = {
            user: {
                userId: "kys",
                nickname: "yushin",
            },
            body: {
                newNickname: "newYushin",
                newPassword: "54321",
                newConfirmPassword: "54321",
                password: "12345",
            },
        };

        bcrypt.compare.mockReturnValue(Promise.resolve(true));

        const error = new Error("데이터베이스 탐색 중 에러가 발생했습니다.");
        User.findOne.mockReturnValue(Promise.reject(error));

        await modifyUserInfo(req, res, next);
        
        expect(next).toBeCalledWith(error);
    });

    test("[uut-04-7] 요청 바디에 newNickname과 newPassword의 값이 존재하면 조회한 로우에 값을 저장하는 연산이 수행된다.", async () => {
        const req = {
            user: {
                userId: "kys",
                nickname: "yushin",
            },
            body: {
                newNickname: "newYushin",
                newPassword: "54321",
                newConfirmPassword: "54321",
                password: "12345",
            },
        };

        bcrypt.compare.mockReturnValue(Promise.resolve(true));

        const user = {
            nickname: '',
            password: '',
            save: jest.fn(() => Promise.resolve(true)),
        };
        User.findOne.mockReturnValue(Promise.resolve(user));
        bcrypt.hash.mockReturnValue(Promise.resolve(req.body.newPassword));

        await modifyUserInfo(req, res, next);

        expect(user.nickname).toEqual(req.body.newNickname);
        expect(user.password).toEqual(req.body.newPassword);
    });

    test("[uut-04-8] 요청 바디에 newNickname 값이 존재하지 않으면 조회한 로우에 값을 저장하는 연산이 수행되지 않는다.", async () => {
        const req = {
            user: {
                userId: "kys",
                nickname: "yushin",
            },
            body: {
                newNickname: '',
                newPassword: "54321",
                newConfirmPassword: "54321",
                password: "12345",
            },
        };

        bcrypt.compare.mockReturnValue(Promise.resolve(true));

        const user = {
            nickname: '',
            password: '',
            save: jest.fn(() => Promise.resolve(true)),
        };
        User.findOne.mockReturnValue(Promise.resolve(user));
        bcrypt.hash.mockReturnValue(Promise.resolve(req.body.newPassword));

        await modifyUserInfo(req, res, next);

        expect(user.nickname).toEqual(user.nickname);
    });

    test("요청 바디에 newPassword의 값이 존재하지 않으면 조회한 로우에 값을 저장하는 연산이 수행되지 않는다.", async () => {
        const req = {
            user: {
                userId: "kys",
                nickname: "yushin",
            },
            body: {
                newNickname: "newYushin",
                newPassword: '',
                newConfirmPassword: '',
                password: "12345",
            },
        };

        bcrypt.compare.mockReturnValue(Promise.resolve(true));

        const user = {
            nickname: '',
            password: "기존 비밀번호",
            save: jest.fn(() => Promise.resolve(true)),
        };
        User.findOne.mockReturnValue(Promise.resolve(user));
        bcrypt.hash.mockReturnValue(Promise.resolve(true));

        await modifyUserInfo(req, res, next);

        expect(user.password).toEqual(user.password);
    });

    test("[uut-04-10] 데이터베이스 저장 작업 중 에러 발생 시 next(error)를 호출한다.", async () => {
        const req = {
            user: {
                userId: "kys",
                nickname: "yushin",
            },
            body: {
                newNickname: "newYushin",
                newPassword: "54321",
                newConfirmPassword: "54321",
                password: "12345",
            },
        };

        bcrypt.compare.mockReturnValue(Promise.resolve(true));
        const error = new Error("데이터베이스 저장 중 에러가 발생했습니다.");
        User.findOne.mockReturnValue({
            save: jest.fn(() => Promise.reject(error)),
        });
        bcrypt.hash.mockReturnValue(Promise.resolve(true));

        await modifyUserInfo(req, res, next);

        expect(next).toBeCalledWith(error);
    });
});

// [u-05] 회원 탈퇴
describe("[u-05] deleteUserInfo", () => {
    const res = {
        status: jest.fn(() => res),
        send: jest.fn(),
    };
    const next = jest.fn();

    test("[uut-05-1] 확인 메시지가 일치하고 데이터베이스에서 삭제된 경우 회원 탈퇴한다.", async () => {
        const req = {
            user: {
                userId: "yushin",
            },
            body: {
                confirmMessage: "회원 탈퇴를 희망합니다.",
            },
            logout: jest.fn((callback) => {
                callback();
            }),
        };

        await deleteUserInfo(req, res, next);
        
        expect(res.status).toBeCalledWith(200);
        expect(res.send).toBeCalledWith("회원 탈퇴가 완료되었습니다.");
    });
    
    test("[uut-05-2] 확인 메시지가 일치하지 않을 경우 회원 탈퇴에 실패한다.", async () => {
        const req = {
            user: {
                userId: "yushin",
            },
            body: {
                confirmMessage: "회원 탈퇴를 희망합니다?",
            },
            logout: jest.fn((callback) => {
                callback();
            }),
        };
        await deleteUserInfo(req, res, next);
        
        expect(res.status).toBeCalledWith(400);
        expect(res.send).toBeCalledWith("확인 메시지가 잘못되었습니다.");
    });

    test("[uut-05-3] 데이터베이스 에러 발생 시 next(error)를 호출한다.", async () => {
        const req = {
            user: {
                userId: "yushin",
            },
            body: {
                confirmMessage: "회원 탈퇴를 희망합니다.",
            },
            logout: jest.fn((callback) => {
                callback();
            }),
        };

        const error = new Error("데이터베이스 삭제 작업 중 에러가 발생했습니다.");
        User.destroy.mockReturnValue(Promise.reject(error));

        await deleteUserInfo(req, res, next);

        expect(next).toBeCalledWith(error);
    });
})

// [u-06] 로그아웃
describe("[u-06] logout", () => {
    const req = {
        logout: jest.fn(callback => callback()),
    };
    const res = {
        status: jest.fn(() => res),
        send: jest.fn(),
    };

    test("[uut-06-1] 로그아웃을 시도하면 로그아웃에 성공한다.", () => {
        logout(req, res);

        expect(res.status).toBeCalledWith(200);
        expect(res.send).toBeCalledWith("로그아웃에 성공하였습니다.");
    });
});