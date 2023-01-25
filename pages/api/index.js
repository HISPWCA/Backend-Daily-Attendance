import { join } from 'path'

import fs from 'fs'
import moment from 'moment'
import base64 from 'base-64'

import elementList from '../../elements/elementList.json'
import { FAILDED, INCORRECT_PHONE_NUMBER, SUCCESS, WRONG, WRONG_FORMAT } from '../../utils/constants'
import { oldFormatMapping } from '../../utils/formatMapping'
import { SMS_ROUTE_API } from '../../utils/api.route'

const writeTofile = (data, LOG_FILE_NAME = 'log-'.concat(moment().format('DD-MM-YYYY').toString()).concat('.json')) => {
  if (data) {
    const FILE_UPLOAD_PATH = process.env.UPLOAD_FOLD.startsWith('/') ? process.env.UPLOAD_FOLD.split('/')[1] : process.env.UPLOAD_FOLD

    // create upload files if not exist 
    if (!fs.existsSync(FILE_UPLOAD_PATH))
      fs.mkdirSync(FILE_UPLOAD_PATH, { recursive: true })

    const writer = fs.createWriteStream(join(FILE_UPLOAD_PATH, LOG_FILE_NAME))
    writer.write(data)
  }
}

const readFile = (LOG_FILE_NAME = 'log-'.concat(moment().format('DD-MM-YYYY').toString()).concat('.json')) => {
  try {
    const FILE_UPLOAD_PATH = process.env.UPLOAD_FOLD.startsWith('/') ? process.env.UPLOAD_FOLD.split('/')[1] : process.env.UPLOAD_FOLD

    if (!fs.existsSync(FILE_UPLOAD_PATH))
      fs.mkdirSync(FILE_UPLOAD_PATH, { recursive: true })

    const datas = fs.readFileSync(join(FILE_UPLOAD_PATH, LOG_FILE_NAME), 'utf8')
    return JSON.parse(datas)
  } catch (err) {

    if (err.code === 'ENOENT')
      return null
  }
}

const getPeriod = (period_string = '') => {
  const current_year = moment().get('year')
  const last_year = moment().subtract(1, 'years').get('year').toString()

  const get_mois = period_string.substring(2, 4)
  const get_day = period_string.substring(0, 2)

  let new_string = moment().format('YYYYMMDD')
  if (get_day && get_mois && last_year && current_year) {
    const date_actuel = moment(''.concat(current_year).concat(get_mois).concat(get_day))

    if (moment().isBefore(date_actuel))
      new_string = ''.concat(last_year).concat(get_mois).concat(get_day)
    else
      new_string = ''.concat(current_year).concat(get_mois).concat(get_day)
  }

  return new_string
}

const getCorrectPhoneNumber = (phone, url) => {
  if (phone && url) {
    const get_phone_number = url.split('phone=')?.[1]

    if (!get_phone_number.startsWith('+'))
      return '+'.concat(phone)
    else
      return phone
  }
}

const ReplaceAll = (search, replaceWith, entry) => entry.split(search).join(replaceWith)

const getUserOrganisationUnit = async phone => {
  try {
    if (!phone)
      throw new Error('No phone  number')

    const route = process.env.SERVER_URL.concat('/users.json?fields=id,name,displayName,phoneNumber,organisationUnits[id,name,displayName,level]&paging=false&filter=phoneNumber:like:'.concat(ReplaceAll('+', '', phone)))

    const request = await fetch(route, {
      headers: {
        'Authorization': 'Basic ' + base64.encode(process.env.SERVER_USERNAME + ':' + process.env.SERVER_PASSWORD)
      }
    })
    const response = await request.json()

    if (response.status === 'ERROR')
      throw response

    const users = response.users
    const user = users?.[0]

    if (!user)
      throw new Error('User not found ')

    if (user?.organisationUnits?.length === 0)
      throw new Error('No organisation unit assigned to this user')

    return user?.organisationUnits[0]
  } catch (err) {
    throw err
  }
}



const sendDataToDHIS2 = async payload => {
  try {
    const request = await fetch(process.env.SERVER_URL.concat('/dataValueSets.json'), {
      body: JSON.stringify(payload),
      method: 'post',
      headers: {
        'content-type': 'application/json',
        'Authorization': 'Basic ' + base64.encode(process.env.SERVER_USERNAME + ':' + process.env.SERVER_PASSWORD)
      }
    })

    const response = await request.json()
    if (response.status === 'ERROR')
      throw response

    return response
  } catch (err) {
    throw err
  }
}


const sendSMS = async payload => {
  try {
    if (payload) {

      const request = await fetch(process.env.SERVER_URL.concat(SMS_ROUTE_API), {
        method: "post",
        body: JSON.stringify(payload),
        headers: {
          "content-type": "application/json",
          "Authorization": "Basic " + base64.encode(process.env.SERVER_USERNAME.concat(':').concat(process.env.SERVER_PASSWORD))
        }
      })

      const response = await request.json()

      if (response.status === "ERROR")
        throw response

      console.log(response)
    }
  } catch (err) {
    console.log("----------------------------")
    console.log("Sms log error")
    console.log(err)
    console.log("PAYLOAD : ", payload)
    console.log("----------------------------")
  }
}

const handler = async (req, res) => {
  let type_error = FAILDED
  let MESSAGE_KEY = "SUCCESS"

  try {
    if (req.method === 'GET') {
      res.setHeader('Access-Control-Allow-Credentials', true)
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST')
      res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
      )

      const { text: sms_string, phone: phoneNumber } = req.query
      const phone = getCorrectPhoneNumber(phoneNumber, req.url)

      if (!phone || phone.trim() === '') {
        type_error = WRONG
        MESSAGE_KEY = INCORRECT_PHONE_NUMBER
        throw new Error('Incorrect phone number')
      }

      if (!sms_string) {
        type_error = WRONG
        MESSAGE_KEY = WRONG_FORMAT
        throw new Error('Query parameter << text=? >> missing !')
      }

      if (sms_string) {
        const existing_data = readFile()

        writeTofile(JSON.stringify(existing_data && existing_data.length > 0 ?
          existing_data.concat({
            date: moment().format('DD-MM-YYYY H:mm:ss'),
            text: sms_string,
            phone: phone ? ReplaceAll(' ', '', phone) : ''
          }) : [{
            date: moment().format('DD-MM-YYYY H:mm:ss'),
            text: sms_string,
            phone: phone ? ReplaceAll(' ', '', phone) : ''
          }]))

        if (!sms_string.includes('orgUnit')) {

          if (!phone) {
            MESSAGE_KEY = INCORRECT_PHONE_NUMBER
            throw new Error('Phone number is required ')
          }


          if (!oldFormatMapping(sms_string)) {
            type_error = WRONG
            MESSAGE_KEY = WRONG_FORMAT
            throw new Error('Wrong format')
          } else {
            const user_org_unit = await getUserOrganisationUnit(ReplaceAll(' ', '', phone))

            if (user_org_unit) {
              const ATT_AM_LBE_name = sms_string.split(' ')[0]
              const ATT_AM_LBE_period = sms_string.split(' ')[1]
              const currentElement = elementList.smsCommands.find(el => el.name === ATT_AM_LBE_name)

              if (!currentElement) {
                type_error = WRONG
                MESSAGE_KEY = WRONG_FORMAT
                throw new Error('Wrong SMS Format')
              }

              const TP = sms_string.includes('TP.') && sms_string.split('TP.')[1].split('.')?.[0]
              const AP = sms_string.includes('AP.') && sms_string.split('AP.')[1].split('.')?.[0]
              const AW = sms_string.includes('AW.') && sms_string.split('AW.')[1].split('.')?.[0]
              const LA = sms_string.includes('LA.') && sms_string.split('LA.')[1].split('.')?.[0]
              const LB = sms_string.includes('LB.') && sms_string.split('LB.')[1].split('.')?.[0]
              const SP = sms_string.includes('SP.') && sms_string.split('SP.')[1].split('.')?.[0]
              const SA = sms_string.includes('SA.') && sms_string.split('SA.')[1].split('.')?.[0]
              const FP = sms_string.includes('FP.') && sms_string.split('FP.')[1].split('.')?.[0]

              if (currentElement) {
                const TP_dataElement = TP && currentElement.smsCodes.find(dataElement => dataElement.code === 'TP')?.dataElement
                const AP_dataElement = AP && currentElement.smsCodes.find(dataElement => dataElement.code === 'AP')?.dataElement
                const AW_dataElement = AW && currentElement.smsCodes.find(dataElement => dataElement.code === 'AW')?.dataElement
                const LA_dataElement = LA && currentElement.smsCodes.find(dataElement => dataElement.code === 'LA')?.dataElement
                const LB_dataElement = LB && currentElement.smsCodes.find(dataElement => dataElement.code === 'LB')?.dataElement
                const SP_dataElement = SP && currentElement.smsCodes.find(dataElement => dataElement.code === 'SP')?.dataElement
                const SA_dataElement = SA && currentElement.smsCodes.find(dataElement => dataElement.code === 'SA')?.dataElement
                const FP_dataElement = FP && currentElement.smsCodes.find(dataElement => dataElement.code === 'FP')?.dataElement

                const dataValues = []
                if (TP_dataElement)
                  dataValues.push({ value: ''.concat(parseInt(TP)), dataElement: TP_dataElement.id })

                if (AP_dataElement)
                  dataValues.push({ value: ''.concat(parseInt(AP)), dataElement: AP_dataElement.id })

                if (AW_dataElement)
                  dataValues.push({ value: ''.concat(parseInt(AW)), dataElement: AW_dataElement.id })

                if (LA_dataElement)
                  dataValues.push({ value: ''.concat(parseInt(LA)), dataElement: LA_dataElement.id })

                if (LB_dataElement)
                  dataValues.push({ value: ''.concat(parseInt(LB)), dataElement: LB_dataElement.id })

                if (SP_dataElement)
                  dataValues.push({ value: ''.concat(parseInt(SP)), dataElement: SP_dataElement.id })

                if (SA_dataElement)
                  dataValues.push({ value: ''.concat(parseInt(SA)), dataElement: SA_dataElement.id })

                if (FP_dataElement)
                  dataValues.push({ value: ''.concat(parseInt(FP)), dataElement: FP_dataElement.id })


                if (dataValues.length === 0) {
                  MESSAGE_KEY = WRONG_FORMAT
                  throw new Error('Wrong format')
                }


                const payload = {
                  dataSet: currentElement.dataset.id,
                  completeDate: moment().format('YYYY-MM-DD'),
                  period: getPeriod(ATT_AM_LBE_period),
                  orgUnit: user_org_unit.id,
                  dataValues
                }

                let sendResponse = ''
                if (payload) {
                  sendResponse = await sendDataToDHIS2({ ...payload })

                  MESSAGE_KEY = SUCCESS
                  await sendRightFeedback(MESSAGE_KEY, phone ? ReplaceAll(' ', '', phone) : null)

                  const existing_success_data = readFile('success-log-'.concat(moment().format('DD-MM-YYYY').toString()).concat('.json'))
                  writeTofile(JSON.stringify(existing_success_data && existing_success_data.length > 0 ?
                    existing_success_data.concat({
                      status: 'SUCCESS',
                      date: moment().format('DD-MM-YYYY H:mm:ss'),
                      text: sms_string,
                      phone: phone ? ReplaceAll(' ', '', phone) : '',
                      send_response: sendResponse
                    }) : [{
                      status: 'SUCCESS',
                      date: moment().format('DD-MM-YYYY H:mm:ss'),
                      text: sms_string,
                      phone: phone ? ReplaceAll(' ', '', phone) : '',
                      send_response: sendResponse
                    }]), 'success-log-'.concat(moment().format('DD-MM-YYYY').toString()).concat('.json'))
                }

                return res.status(200).json({ success: true, message: 'Operation successfully !', payload, send_response: sendResponse })
              }
            }

          }

        } else {
          const ATT_AM_LBE_name = sms_string.includes('.') && sms_string.split('.')[0]
          const ATT_AM_LBE_period = sms_string.includes('.') && sms_string.split('.')[1]
          const currentElement = elementList.smsCommands.find(el => el.name === ATT_AM_LBE_name)
          const orgUnitID = sms_string.includes('orgUnit.') && sms_string.split('orgUnit.')[1].split('.')[0]

          const TP = sms_string.includes('TP.') && sms_string.split('TP.')[1].split('.')?.[0]
          const AP = sms_string.includes('AP.') && sms_string.split('AP.')[1].split('.')?.[0]
          const AW = sms_string.includes('AW.') && sms_string.split('AW.')[1].split('.')?.[0]
          const LA = sms_string.includes('LA.') && sms_string.split('LA.')[1].split('.')?.[0]
          const LB = sms_string.includes('LB.') && sms_string.split('LB.')[1].split('.')?.[0]
          const SP = sms_string.includes('SP.') && sms_string.split('SP.')[1].split('.')?.[0]
          const SA = sms_string.includes('SA.') && sms_string.split('SA.')[1].split('.')?.[0]
          const FP = sms_string.includes('FP.') && sms_string.split('FP.')[1].split('.')?.[0]

          if (currentElement) {
            const TP_dataElement = TP && currentElement.smsCodes.find(dataElement => dataElement.code === 'TP')?.dataElement
            const AP_dataElement = AP && currentElement.smsCodes.find(dataElement => dataElement.code === 'AP')?.dataElement
            const AW_dataElement = AW && currentElement.smsCodes.find(dataElement => dataElement.code === 'AW')?.dataElement
            const LA_dataElement = LA && currentElement.smsCodes.find(dataElement => dataElement.code === 'LA')?.dataElement
            const LB_dataElement = LB && currentElement.smsCodes.find(dataElement => dataElement.code === 'LB')?.dataElement
            const SP_dataElement = SP && currentElement.smsCodes.find(dataElement => dataElement.code === 'SP')?.dataElement
            const SA_dataElement = SA && currentElement.smsCodes.find(dataElement => dataElement.code === 'SA')?.dataElement
            const FP_dataElement = FP && currentElement.smsCodes.find(dataElement => dataElement.code === 'FP')?.dataElement

            const dataValues = []
            if (TP_dataElement)
              dataValues.push({ value: ''.concat(parseInt(TP)), dataElement: TP_dataElement.id })

            if (AP_dataElement)
              dataValues.push({ value: ''.concat(parseInt(AP)), dataElement: AP_dataElement.id })

            if (AW_dataElement)
              dataValues.push({ value: ''.concat(parseInt(AW)), dataElement: AW_dataElement.id })

            if (LA_dataElement)
              dataValues.push({ value: ''.concat(parseInt(LA)), dataElement: LA_dataElement.id })

            if (LB_dataElement)
              dataValues.push({ value: ''.concat(parseInt(LB)), dataElement: LB_dataElement.id })

            if (SP_dataElement)
              dataValues.push({ value: ''.concat(parseInt(SP)), dataElement: SP_dataElement.id })

            if (SA_dataElement)
              dataValues.push({ value: ''.concat(parseInt(SA)), dataElement: SA_dataElement.id })

            if (FP_dataElement)
              dataValues.push({ value: ''.concat(parseInt(FP)), dataElement: FP_dataElement.id })


            if (dataValues.length === 0) {
              MESSAGE_KEY = WRONG_FORMAT
              throw new Error('Wrong format')
            }


            const payload = {
              dataSet: currentElement.dataset.id,
              completeDate: moment().format('YYYY-MM-DD'),
              period: ATT_AM_LBE_period,
              orgUnit: orgUnitID,
              dataValues
            }

            let sendResponse = ''
            if (payload) {
              sendResponse = await sendDataToDHIS2({ ...payload })

              MESSAGE_KEY = SUCCESS
              await sendRightFeedback(MESSAGE_KEY, phone ? ReplaceAll(' ', '', phone) : null)

              const existing_success_data = readFile('success-log-'.concat(moment().format('DD-MM-YYYY').toString()).concat('.json'))
              writeTofile(JSON.stringify(existing_success_data && existing_success_data.length > 0 ?
                existing_success_data.concat({
                  status: 'SUCCESS',
                  date: moment().format('DD-MM-YYYY H:mm:ss'),
                  text: sms_string,
                  phone: phone ? ReplaceAll(' ', '', phone) : '',
                  send_response: sendResponse
                }) : [{
                  status: 'SUCCESS',
                  date: moment().format('DD-MM-YYYY H:mm:ss'),
                  text: sms_string,
                  phone: phone ? ReplaceAll(' ', '', phone) : '',
                  send_response: sendResponse
                }]), 'success-log-'.concat(moment().format('DD-MM-YYYY').toString()).concat('.json'))
            }

            return res.status(200).json({ success: true, message: 'Operation successfully !', payload, send_response: sendResponse })
          } else {

            throw new Error('Incorrect Format')
          }
        }
      }

      type_error = WRONG
      throw new Error('Incorrect information')
    }
  } catch (err) {
    const existing_error_data = readFile('error-log-'.concat(moment().format('DD-MM-YYYY').toString()).concat('.json'))
    writeTofile(JSON.stringify(existing_error_data && existing_error_data.length > 0 ?
      existing_error_data.concat({
        status: 'ERROR',
        date: moment().format('DD-MM-YYYY H:mm:ss'),
        query: req.query,
        errorMessage: err.message
      }) : [{
        status: 'ERROR',
        date: moment().format('DD-MM-YYYY H:mm:ss'),
        query: req.query,
        errorMessage: err.message
      }]), 'error-log-'.concat(moment().format('DD-MM-YYYY').toString()).concat('.json'))

    sendRightFeedback(MESSAGE_KEY, getCorrectPhoneNumber(req.query?.phone, req.url) ? ReplaceAll(' ', '', getCorrectPhoneNumber(req.query?.phone, req.url)) : null)
    res.status(500).json({ error: true, message: err.message })
  }
}


const sendRightFeedback = async (MESSAGE_KEY, telephone) => {
  try {
    if (telephone && MESSAGE_KEY && MESSAGE_KEY?.trim()?.length > 0 && process.env.SEND_SMS_BY_APP === "true") {

      let SMSPayload = null


      if (MESSAGE_KEY === SUCCESS) {
        SMSPayload = {
          message: process.env.SUCCESS_SEND_MESSAGE,
          recipients: [telephone]
        }
      }

      if (MESSAGE_KEY === WRONG_FORMAT) {
        SMSPayload = {
          message: process.env.WRONG_FORMAT_MESSAGE,
          recipients: [telephone]
        }
      }

      console.log("SMS PAYLOAD: ", SMSPayload)
      if (SMSPayload)
        await sendSMS(SMSPayload)

    }
  } catch (err) {
    console.log(err)
  }
}

export default handler
