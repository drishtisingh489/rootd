import { Navigate, Route, Routes } from 'react-router-dom'
import { TabLayout } from './components/BottomNav'
import { Camera } from './screens/Camera'
import { AppData, PreferencesLayout, RequireOnboarded } from './screens/Guards'
import { History, Home } from './screens/Home'
import { InsightTopic, Insights } from './screens/Insights'
import { PreferenceCategory, PreferencesHub } from './screens/Preferences'
import { EditProfile, Profile } from './screens/Profile'
import { ResultDetails, Results } from './screens/Results'
import { Welcome } from './screens/Welcome'

export default function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Welcome />} />

        <Route element={<AppData />}>
          <Route path="/onboarding" element={<PreferencesLayout mode="onboarding" />}>
            <Route index element={<PreferencesHub />} />
            <Route path=":categoryId" element={<PreferenceCategory />} />
          </Route>

          <Route element={<RequireOnboarded />}>
            <Route element={<TabLayout />}>
              <Route path="/home" element={<Home />} />
              <Route path="/history" element={<History />} />
              <Route path="/insights" element={<Insights />} />
              <Route path="/insights/:topic" element={<InsightTopic />} />
            </Route>
            <Route path="/scan" element={<Camera />} />
            <Route path="/results/:scanId" element={<Results />} />
            <Route path="/results/:scanId/details" element={<ResultDetails />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/edit" element={<EditProfile />} />
            <Route path="/profile/preferences" element={<PreferencesLayout mode="edit" />}>
              <Route index element={<PreferencesHub />} />
              <Route path=":categoryId" element={<PreferenceCategory />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
