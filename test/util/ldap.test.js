'use strict'

const ldap = require('ldapjs')
const ldapUtil = require('../../util/ldap')

const BIND_DN = 'cn=root'
const BIND_PW = 'secret'
const SUFFIX = 'dc=test'
const server = ldap.createServer()

jest.mock('config', () => ({
  get: jest.fn()
    .mockImplementationOnce(() => ({
      server: 'ldap://localhost:1389',
      bindDN: 'cn=root',
      password: 'secret',
      filter: {
        base: 'cn=root',
        attributeName: 'mail'
      }
    }))
}))

server.bind(BIND_DN, function (req, res, next) {
  if (req.credentials !== BIND_PW) {
    return next(new ldap.InvalidCredentialsError('Invalid password'))
  }
  res.end()
  return next()
})

server.search(BIND_DN, function (req, res, next) {
  if (req.filter.value === 'demo@example.com') {
    res.send(res.createSearchEntry({
      dn: 'cn=bin,' + SUFFIX
    }))
  }
  res.end()
  return next()
})

server.bind('cn=bin,' + SUFFIX, function (req, res, next) {
  if (req.credentials !== '123456') {
    return next(new ldap.InvalidCredentialsError('Invalid password'))
  }
  res.end()
  return next()
})

server.listen(1389)

describe('test/util/ldap.test.js', () => {
  test('connection', async () => {
    let ldapClient
    try {
      ldapClient = await ldapUtil.createClient()
      await ldapUtil.authenticate(ldapClient, 'demo@example.com', '123456')
    } catch (error) {
      expect(error.message).toEqual('LDAP connection is not yet bound')
    } finally {
      ldapUtil.closeClient(ldapClient)
    }
  })

  test('authenticate', (done) => {
    setTimeout(async () => {
      let ldapClient = await ldapUtil.createClient()
      try {
        const user = await ldapUtil.authenticate(ldapClient, 'demo@example.com', '123456')
        ldapUtil.closeClient(ldapClient)
        expect(user).toBeTruthy()
        await ldapUtil.authenticate(ldapClient, 'demo@example.com', '1234567')
      } catch (error) {
        expect(error.message).toEqual('用户名或密码错误')
      } finally {
        ldapUtil.closeClient(ldapClient)
      }

      try {
        await ldapUtil.authenticate(ldapClient, 'demo2@example.com', '123456')
      } catch (error) {
        expect(error.message).toEqual('用户名或密码错误')
      }
      done()
    }, 1000)
  })
})
