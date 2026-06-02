import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './src/screens/LoginScreen';
import NoteListScreen from './src/screens/NoteListScreen';
import NoteEditorScreen from './src/screens/NoteEditorScreen';
import TeamSettingsScreen from './src/screens/TeamSettingsScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [token, setToken] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('token').then((t) => {
      if (t) setToken(t);
    });
  }, []);

  const handleLogin = (t: string) => {
    setToken(t);
    AsyncStorage.setItem('token', t);
  };

  const handleLogout = async () => {
    setToken(null);
    AsyncStorage.removeItem('token');
  };

  if (token === null) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {token ? (
          <>
            <Stack.Screen name="Notes" options={{ headerShown: false }}>
              {(props) => (
                <NoteListScreen {...props} token={token} onLogout={handleLogout} />
              )}
            </Stack.Screen>
            <Stack.Screen name="Editor" options={{ headerShown: false }}>
              {(props) => <NoteEditorScreen {...props} token={token} />}
            </Stack.Screen>
            <Stack.Screen name="TeamSettings" options={{ headerShown: false }}>
              {(props) => <TeamSettingsScreen {...props} token={token} />}
            </Stack.Screen>
            <Stack.Screen name="Profile" options={{ headerShown: false }}>
              {(props) => <ProfileScreen {...props} token={token} />}
            </Stack.Screen>
          </>
        ) : (
          <Stack.Screen name="Login" options={{ headerShown: false }}>
            {(props) => <LoginScreen {...props} onLogin={handleLogin} />}
          </Stack.Screen>
        )}
      </Stack.Navigator>
      <StatusBar style="light" />
    </NavigationContainer>
  );
}
