import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function blockBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `bloco ${startMarker} precisa existir`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `fim ${endMarker} precisa existir`);
  return source.slice(start, end);
}

test('perfil do usuario usa patch seguro e exibe campos compativeis com cadastro', () => {
  const profile = read('user-profile.html');
  const firebaseService = read('firebaseService.js');
  const functionsSource = read('functions/index.js');
  const profileFunctionBlock = blockBetween(functionsSource, 'exports.updateMyUserProfile', 'exports.getCompanyLogoDataUrl');

  assert.match(profile, /USER_PROFILE_ASSET_VERSION = '2026-06-11-profile-admin-v1'/);
  assert.match(profile, /auth\.js\?v=2026-06-11-profile-admin-v1/);
  assert.match(profile, /menu-component\.js\?v=2026-06-11-profile-admin-v1/);
  assert.match(profile, /firebaseService\.js\?v=2026-06-11-profile-admin-v1/);
  assert.match(profile, /window\.firebaseService = \{ \.\.\.window\.firebaseService, \.\.\.svc \}/);
  assert.match(profile, /id="profileUid"/);
  assert.match(profile, /id="userRole"/);
  assert.match(profile, /id="userCompany"/);
  assert.match(profile, /id="editEmail" class="form-input" readonly/);
  assert.match(profile, /id="editUid" class="form-input" readonly/);
  assert.match(profile, /id="editCompany" class="form-input" readonly/);
  assert.match(profile, /id="editRole" class="form-input" readonly/);
  assert.match(profile, /function mergeProfileData\(authUser, remoteData, localData\)/);
  assert.match(profile, /loadFromFirebase\(`users\/\$\{user\.uid\}`\)/);
  assert.match(profile, /updateMyUserProfile\(patch\)/);
  assert.doesNotMatch(profile, /updateFirebase\(`users\/\$\{uid\}`,\s*\{[\s\S]*displayName:[\s\S]*username:[\s\S]*phone:/);

  assert.match(firebaseService, /updateProfile as firebaseUpdateProfile/);
  assert.match(firebaseService, /function normalizeMyUserProfilePatch\(payload\)/);
  assert.match(firebaseService, /async function updateMyUserProfile\(payload\)/);
  assert.match(firebaseService, /await callFunction\('updateMyUserProfile', patch\)/);
  assert.doesNotMatch(firebaseService, /update\(ref\(db, `users\/\$\{currentUser\.uid\}`\), patch\)/);
  assert.match(firebaseService, /updateMyUserProfile,/);
  assert.match(functionsSource, /exports\.updateMyUserProfile = https\.onCall/);
  assert.match(functionsSource, /function normalizeSelfProfilePayload\(payload\)/);
  assert.match(profileFunctionBlock, /await applyUserPatchAcrossScopes\(uid, patch/);
  assert.doesNotMatch(profileFunctionBlock, /targetUid/);
  assert.match(firebaseService, /displayName: normalizedUsername/);
  assert.match(firebaseService, /profileUpdatedAt: createdAt/);
});

test('admin identifica superadmin operacional sem aplicar acoes comerciais', () => {
  const adminMain = read('scripts/admin/admin-main.js');

  assert.match(adminMain, /ADMIN_ASSET_VERSION = "2026-06-11-profile-admin-v1"/);
  assert.match(adminMain, /function isOperationalSuperAdminUser\(user\)/);
  assert.match(adminMain, /uid === "HfrQ6ObQq2aSEoeEE4Ng9jpAolB3"/);
  assert.match(adminMain, /email === "nedes1@hotmail.com"/);
  assert.match(adminMain, /if \(isOperationalSuperAdminUser\(user \|\| \{\}\)\) return "superadmin";/);
  assert.match(adminMain, /if \(key === "superadmin"\) return "SuperAdmin";/);
  assert.match(adminMain, /Conta operacional/);
  assert.match(adminMain, /!isOperationalAdmin && canGrantAdminTrialForStatus\(statusKey\)/);
  assert.match(adminMain, /if \(!isOperationalAdmin\) \{[\s\S]*deleteSubscriptionDataFlow\(user\)/);
  assert.match(adminMain, /Conta SuperAdmin e operacional nao participa da regua comercial de trial/);
});
