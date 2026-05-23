import { createRouter, createWebHistory } from 'vue-router'
// Changed on 2026-05-23 23:59:00 — Supabase Auth session hydration
import { auth, awaitAuthReady } from '../firebase'

// Lazy loaded views for high performance
// Changed on 2026-05-23 21:04:15
const Home = () => import('../views/Home.vue')
const AdminDashboard = () => import('../views/AdminDashboard.vue')
const AboutUs = () => import('../views/AboutUs.vue')
const SharedTrack = () => import('../views/SharedTrack.vue')
const NotFound = () => import('../views/NotFound.vue')

// Changed on 2026-05-23 21:02:45
const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
    meta: { requiresAuth: false }
  },
  {
    path: '/admin',
    name: 'AdminDashboard',
    component: AdminDashboard,
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/about',
    name: 'AboutUs',
    component: AboutUs
  },
  {
    path: '/track/shared/:token',
    name: 'SharedTrack',
    component: SharedTrack
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: NotFound
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Wait for first session hydration, then return cached user.
// Changed on 2026-05-23 23:59:00
async function getCurrentUser() {
  await awaitAuthReady()
  return auth.currentUser
}

// Changed on 2026-05-23 21:02:45
router.beforeEach(async (to, from, next) => {
  const currentUser = await getCurrentUser()
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const requiresAdmin = to.matched.some(record => record.meta.requiresAdmin)

  if ((requiresAuth || requiresAdmin) && !currentUser) {
    next({ name: 'Home' })
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('open-login-modal'))
    }, 100)
  } else if (requiresAdmin) {
    // Role is loaded into the session during login, avoiding direct users-table RLS reads.
    if (currentUser.role === 'admin') {
      next()
    } else {
      next({ name: 'Home' }) // Redirect non-admins to Home
    }
  } else {
    next()
  }
})

export default router
// Changed on 2026-05-23 19:03:00
