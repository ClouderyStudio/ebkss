import { createRouter, createWebHistory } from 'vue-router';

// 需要登录的路由前缀
const ADMIN_ROUTES = ['/admin', '/teacher/tools', '/teacher/corpus'];

function isAuthenticated() {
  const token = localStorage.getItem('ebkss_token') || '';
  if (!token) return false;
  try {
    // 解码 JWT payload 检查是否过期
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('./views/LoginView.vue') },
    { path: '/', name: 'home', component: () => import('./views/HomeView.vue') },
    { path: '/teacher/quiz', name: 'teacher-quiz', component: () => import('./views/TeacherQuizView.vue') },
    { path: '/class', name: 'classroom', component: () => import('./views/TeacherQuizView.vue') },
    { path: '/student/quiz', name: 'student-quiz', component: () => import('./views/StudentQuizView.vue') },
    { path: '/admin', name: 'admin', component: () => import('./views/ContentAdminView.vue') },
    { path: '/teacher/tools', redirect: '/admin' },
    { path: '/teacher/corpus', redirect: '/admin' }
  ]
});

// 路由守卫：管理员页面需登录
router.beforeEach((to, _from, next) => {
  if (ADMIN_ROUTES.some(r => to.path.startsWith(r)) && !isAuthenticated()) {
    next('/login');
  } else {
    next();
  }
});
