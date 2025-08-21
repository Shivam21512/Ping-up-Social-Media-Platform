import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import api from '../../api/axios.js'
import toast from 'react-hot-toast'

const initialState = {
  value: null,
  loading: false,
  error: null
}

export const fetchUser = createAsyncThunk(
  'user/fetchUser',
  async (token, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/api/user/data', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!data.success) {
        return rejectWithValue(data.message || 'Failed to fetch user')
      }
      return data.user
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message)
    }
  }
)

export const updateUser = createAsyncThunk(
  'user/update',
  async ({ userData, token }, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/api/user/update', userData, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (data.success) {
        toast.success(data.message)
        return data.user
      } else {
        toast.error(data.message)
        return rejectWithValue(data.message)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message)
      return rejectWithValue(err.response?.data?.message || err.message)
    }
  }
)

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    resetUser: (state) => {
      state.value = null
      state.loading = false
      state.error = null
    }
  },
  extraReducers: (builder) => {
    builder
      // fetchUser
      .addCase(fetchUser.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchUser.fulfilled, (state, action) => {
        state.loading = false
        state.value = action.payload
      })
      .addCase(fetchUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      // updateUser
      .addCase(updateUser.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        state.loading = false
        state.value = action.payload
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  }
})

export const { resetUser } = userSlice.actions
export default userSlice.reducer
