/**
 * Global Settings Page - Redirect to Account tab
 */

import { redirect } from 'next/navigation';

export default function SettingsPage() {
  redirect('/app/settings/account');
}

