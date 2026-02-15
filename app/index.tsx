import { Redirect } from 'expo-router';

/**
 * App entry point - redirects to intro page (Log in / Sign up / Demo)
 */
export default function Index() {
  return <Redirect href="/intropage" />;
}
