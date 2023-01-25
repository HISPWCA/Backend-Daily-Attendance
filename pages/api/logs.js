import { join } from 'path'
import fs from 'fs'

import moment from 'moment'
import base64 from 'base-64'

import { oldFormatMapping } from '../../utils/formatMapping'

const readAllFileInUploadDir = async () => {
    try {
        const path = process.env.UPLOAD_FOLD?.startsWith('/') ? process.env.UPLOAD_FOLD.split('/')[1] : ''

        return fs.readdirSync(path)?.reduce((prev, curr) => {

            if (fs.lstatSync(join(path, curr)).isFile())
                prev.push(curr)

            return prev
        }, [])
    } catch (err) {
        throw err
    }
}

const getDatesFromInterval = (startDate, endDate) => {
    let date_list = []

    if (startDate && endDate) {
        if (moment(startDate).isAfter(moment(endDate)))
            throw new Error("Start date can't be gretter that End Date ")

        let current = startDate
        while (moment(current).isSameOrBefore(moment(endDate))) {
            date_list.push(moment(current).format('DD-MM-YYYY'))
            current = moment(current).add(1, 'days')
        }
    }

    return date_list
}

const getFileContent = filepath => {
    let content = null

    if (filepath) {
        try {
            const content_string = fs.readFileSync(filepath, 'utf8')
            content = JSON.parse(content_string)
        } catch (err) {
            console.log("err: ", err)
            content = null
        }
    }

    return content
}

const getUsersList = async () => {
    try {
        const route = process.env.SERVER_URL.concat('/users.json?fields=id,name,displayName,phoneNumber,organisationUnits[id,name,displayName,level]&paging=false')
        const request = await fetch(route, {
            headers: {
                "Authorization": "Basic " + base64.encode(process.env.SERVER_USERNAME + ":" + process.env.SERVER_PASSWORD)
            }
        })

        const response = await request.json()

        if (response.status === "ERROR")
            throw response

        return response.users
    } catch (err) {
        throw err
    }
}

const getOrganisationUnitList = async () => {
    try {
        const route = process.env.SERVER_URL.concat('/organisationUnits.json?fields=id,name,displayName&paging=false')
        const request = await fetch(route, {
            headers: {
                "Authorization": "Basic " + base64.encode(process.env.SERVER_USERNAME + ":" + process.env.SERVER_PASSWORD)
            }
        })

        const response = await request.json()

        if (response.status === "ERROR")
            throw response

        return response.organisationUnits
    } catch (err) {
        throw err
    }
}

const getRequest = async (req, res) => {
    try {
        const { startDate, endDate } = req.query

        if (!startDate)
            throw new Error("Start Date is required ")

        if (!endDate)
            throw new Error("End Date is required ")

        const filesList = await readAllFileInUploadDir()
        const dateList = getDatesFromInterval(startDate, endDate)
        const users_list = await getUsersList()
        const organsation_unit_list = await getOrganisationUnitList()

        let successLogs = []
        let errorLogs = []
        let found_files = []

        if (filesList.length > 0 && dateList.length > 0) {
            found_files = filesList.reduce((prev, curr) => {
                for (let date of dateList) {
                    if (curr?.includes(date) && curr?.endsWith(process.env.FILE_SUFFIX)) {

                        if (curr.includes('success-log')) {
                            const path = process.env.UPLOAD_FOLD?.startsWith('/') ? join(process.env.UPLOAD_FOLD.split('/')[1], curr) : ''
                            const content = getFileContent(path)
                            if (content) {

                                const path = process.env.UPLOAD_FOLD?.startsWith('/') ? join(process.env.UPLOAD_FOLD.split('/')[1], curr) : ''
                                const content = getFileContent(path)
                                if (content) {

                                    successLogs = successLogs.concat(
                                        content.map(c => {
                                            let ou = undefined
                                            let founded_user = null
                                            if (!c.text?.includes('orgUnit')) {
                                                if (c?.phone) {
                                                    founded_user = users_list.find(user => user.phoneNumber === c.phone)
                                                    if (founded_user) {
                                                        ou = founded_user.organisationUnits?.[0] || null
                                                    }
                                                }
                                            } else {
                                                const orgUnitId = c.text?.split('orgUnit.')?.[1]?.split('.')?.[0]
                                                const found_ou = organsation_unit_list.find(o => o.id === orgUnitId)
                                                if (found_ou) {
                                                    ou = found_ou
                                                }
                                            }

                                            return {
                                                status: c.status,
                                                phone: c.phone,
                                                text: c.text,
                                                organisationUnit: ou,
                                                description: c.send_response?.description ? c.send_response?.description : c.send_response?.response?.description ? c.send_response?.response?.description : null,
                                                importCount: c.send_response?.importCount ? c.send_response?.importCount : c.send_response?.response?.importCount ? c.send_response?.response?.importCount : null,
                                                date: c.date,
                                                format: c.text?.includes('orgUnit') ? { id: 'NEW', title: 'New' } : oldFormatMapping(c.text) ? { id: 'OLD', title: 'Old' } : { id: 'WRONG', title: 'Wrong' },
                                                version: !founded_user ? { id: 'PERSONNAL_SIM', title: 'Personnal SIM' } : { id: 'GUC_SIM', title: 'CUG SIM' }
                                            }
                                        })
                                    )
                                }
                            }
                        }

                        if (curr.includes('error-log')) {
                            const path = process.env.UPLOAD_FOLD?.startsWith('/') ? join(process.env.UPLOAD_FOLD.split('/')[1], curr) : ''
                            const content = getFileContent(path)
                            if (content) {
                                errorLogs = errorLogs.concat(
                                    content.map(c => {

                                        let ou = undefined
                                        let founded_user = null

                                        if (!c.query?.text?.includes('orgUnit')) {
                                            if (c?.query?.phone) {
                                                founded_user = users_list.find(user => user.phoneNumber === c.query?.phone)
                                                if (founded_user) {
                                                    ou = founded_user.organisationUnits?.[0] || undefined
                                                }
                                            }
                                        } else {
                                            const orgUnitId = c.text?.split('orgUnit.')?.[1]?.split('.')?.[0]
                                            ou = organsation_unit_list.find(o => o.id === orgUnitId) || undefined
                                        }

                                        return {
                                            status: c.status,
                                            phone: c.query?.phone,
                                            text: c.query?.text,
                                            message: c.errorMessage,
                                            organisationUnit: ou,
                                            date: c.date,
                                            format: c?.query?.text?.includes('orgUnit') ? { id: 'NEW', title: 'New' } : oldFormatMapping(c?.query?.text) ? { id: 'OLD', title: 'Old' } : { id: 'WRONG', title: 'Wrong' },
                                            version: !founded_user ? { id: 'PERSONNAL_SIM', title: 'Personnal SIM' } : { id: 'GUC_SIM', title: 'CUG SIM' }
                                        }
                                    })
                                )
                            }
                        }

                        prev.push(curr)
                    }
                }

                return prev
            }, [])
        }
        // console.log(successLogs)
        return res.status(200).json({
            status: "SUCCESS",
            data: {
                errorLogs,
                successLogs,
                startDate,
                endDate,
                dateRanges: dateList.map(date => moment(date, 'DD-MM-YYYY').format('YYYY-MM-DD')),
                totalSuccessLogs: successLogs.length,
                totalErrorLogs: errorLogs.length,
                totalLogs: successLogs.length + errorLogs.length,
                totalLogsInDB: filesList.length,
            }
        })

    } catch (err) {
        res.status(500).json({ status: "ERROR", message: err.message })
    }
}

const handler = (req, res) => {

    res.setHeader('Access-Control-Allow-Credentials', true)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST')
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    )

    return req.method === "GET" ? getRequest(req, res) : res.status(500).json({ status: "ERROR", message: "Method not found" })
}


export default handler
