import axios from "axios";
import { useContext, useState } from "react"
import { UserContext } from "./UserContext";

export function RegisterAndLoginForm() {

    const [ username,setUsername ] = useState('');
    const [ password,setPassword ] = useState('');
    const [ isRegisterOrLogin,setIsRegisterOrLogin ] = useState('login');
    const {setUsername: setLoggedInUsername,setId} = useContext(UserContext)

    const handelSubmit = async (ev) => {
        ev.preventDefault();

        const url = isRegisterOrLogin === 'register' ? 'register' : 'login';

        const {data} = await axios.post(url,{username,password});
        setLoggedInUsername(username);
        setId(data.id);
    }

    return (
        <div className="bg-blue-50 h-screen flex items-center">
            <form className="w-64 mx-auto mb-12" onSubmit={handelSubmit}>
                <input
                    type="text"
                    placeholder="Username"
                    className="block w-full p-2 mb-2 border"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    />
                <input
                    type="password"
                    placeholder="Password"
                    className="block w-full p-2 mb-2 border"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    />
                <button className="bg-blue-500 text-white block w-full rounded-sm p-2">
                    {isRegisterOrLogin === 'register' ? 'Register' : 'Login'}
                    </button>

                { isRegisterOrLogin === 'register' && (
                    <div className="text-center mt-2">
                        Already a member?
                        <button onClick={() => setIsRegisterOrLogin('login')}>
                            Login here
                        </button>
                    </div>
                )}

                { isRegisterOrLogin === 'login' && (
                    <div className="text-center mt-2">
                        Don't have an account?
                        <button className="ml-1" onClick={() => setIsRegisterOrLogin('register')}>
                            Register
                        </button>
                    </div>
                )}

            </form>
        </div>
    )
}