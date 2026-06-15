import { createRouter, createWebHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('./views/HomeView.vue') },
    { path: '/teacher/quiz', name: 'teacher-quiz', component: () => import('./views/TeacherQuizView.vue') },
    { path: '/class', name: 'classroom', component: () => import('./views/TeacherQuizView.vue') },
    { path: '/student/quiz', name: 'student-quiz', component: () => import('./views/StudentQuizView.vue') },
    { path: '/teacher/tools', name: 'teacher-tools', component: () => import('./views/TeacherToolsView.vue') },
    { path: '/teacher/corpus', name: 'teacher-corpus', component: () => import('./views/CorpusManagerView.vue') }
  ]
});
