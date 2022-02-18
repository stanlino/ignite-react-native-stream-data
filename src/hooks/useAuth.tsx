import { makeRedirectUri, revokeAsync, startAsync } from 'expo-auth-session';
import React, { useEffect, createContext, useContext, useState, ReactNode } from 'react';
import { generateRandom } from 'expo-auth-session/build/PKCE';

import { api } from '../services/api';

interface User {
  id: number;
  display_name: string;
  email: string;
  profile_image_url: string;
}

interface AuthContextData {
  user: User;
  isLoggingOut: boolean;
  isLoggingIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

interface AuthProviderData {
  children: ReactNode;
}

interface AuthorizationResponse {
  type: string 
  params: {
    access_token: string
    state: string
    error: string
  }
}

const AuthContext = createContext({} as AuthContextData);

const { CLIENT_ID } = process.env

const twitchEndpoints = {
  authorization: 'https://id.twitch.tv/oauth2/authorize',
  revocation: 'https://id.twitch.tv/oauth2/revoke'
};

function AuthProvider({ children }: AuthProviderData) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [user, setUser] = useState({} as User);
  const [userToken, setUserToken] = useState('');

  // get CLIENT_ID from environment variables

  async function signIn() {
    try {

      setIsLoggingIn(true)

      const REDIRECT_URI = makeRedirectUri({ useProxy: true })
      const RESPONSE_TYPE = 'token'
      const SCOPE = encodeURI('openid user:read:email user:read:follows')
      const FORCE_VERIFY = true
      const STATE = generateRandom(30)

      const authUrl = `${twitchEndpoints.authorization}?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=${RESPONSE_TYPE}&scope=${SCOPE}&force_verify=${FORCE_VERIFY}&state=${STATE}`
      
      const { type, params } = await startAsync({ authUrl }) as AuthorizationResponse

      if (type !== 'success' || params.error === 'access_denied') new Error('Problema ao se autenticar')

      if (params.state !== STATE) new Error('Invalid state value')

      api.defaults.headers.authorization = `Bearer ${params.access_token}`

      const userResponse = await api.get('/users')

      const userReponseFilttred = userResponse.data.data[0]

      setUser({
        display_name: userReponseFilttred.display_name,
        email: userReponseFilttred.email,
        id: userReponseFilttred.id,
        profile_image_url: userReponseFilttred.profile_image_url
      })

      setUserToken(params.access_token)

    } catch (error) {
      new Error()
    } finally {
      setIsLoggingIn(false)
    }
  }

  async function signOut() {
    try {
      // set isLoggingOut to true

      setIsLoggingOut(true)

      // call revokeAsync with access_token, client_id and twitchEndpoint revocation
      await revokeAsync({token: userToken, clientId: CLIENT_ID}, {revocationEndpoint: twitchEndpoints.revocation})
    } catch (error) {
    } finally {
      // set user state to an empty User object

      setUser({} as User)
      // set userToken state to an empty string

      setUserToken('')

      // remove "access_token" from request's authorization header

      delete api.defaults.headers.authorization

      setIsLoggingOut(false)

      // set isLoggingOut to false
    }
  }

  useEffect(() => {
    // add client_id to request's "Client-Id" header

    api.defaults.headers['Client-Id'] = CLIENT_ID
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoggingOut, isLoggingIn, signIn, signOut }}>
      { children }
    </AuthContext.Provider>
  )
}

function useAuth() {
  const context = useContext(AuthContext);

  return context;
}

export { AuthProvider, useAuth };
