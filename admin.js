
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
} from './supabase-config.js';

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const $ = (id) => document.getElementById(id);

// غيّر اسم الملف هنا لو صفحة لوحة التحكم عندك اسمها مختلف
const DASHBOARD_PAGE = './dashboard.html';

const form = $('loginForm');
const emailInput = $('email');
const passwordInput = $('password');
const status = $('status');

function showMessage(message, isError = true) {
  if (!status) {
    alert(message);
    return;
  }

  status.textContent = message;
  status.style.color = isError ? '#c62828' : '#16803c';
}

async function checkAdminAndRedirect() {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError) {
    showMessage('تعذر التحقق من تسجيل الدخول: ' + sessionError.message);
    return;
  }

  const session = sessionData.session;

  if (!session) {
    showMessage('سجّل الدخول باستخدام حساب المدير.');
    return;
  }

  const { data: isAdmin, error: adminError } =
    await supabase.rpc('is_store_admin');

  if (adminError) {
    console.error('Admin verification error:', adminError);
    showMessage(
      'تم تسجيل الدخول، لكن تعذر التحقق من صلاحية المدير. راجع إعدادات Supabase.'
    );
    return;
  }

  if (isAdmin !== true) {
    await supabase.auth.signOut();
    showMessage('هذا الحساب ليس مديرًا مصرحًا له.');
    return;
  }

  window.location.href = DASHBOARD_PAGE;
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = emailInput?.value.trim();
  const password = passwordInput?.value;

  if (!email || !password) {
    showMessage('اكتب البريد الإلكتروني وكلمة السر.');
    return;
  }

  const submitButton = form.querySelector(
    'button[type="submit"], input[type="submit"]'
  );

  if (submitButton) submitButton.disabled = true;

  showMessage('جاري تسجيل الدخول...', false);

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      showMessage('تعذر تسجيل الدخول: ' + error.message);
      return;
    }

    await checkAdminAndRedirect();
  } catch (error) {
    console.error('Login error:', error);
    showMessage('حصل خطأ غير متوقع. افتح Console لمعرفة التفاصيل.');
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

// لو فيه جلسة محفوظة، افحص صلاحية الحساب
checkAdminAndRedirect();
