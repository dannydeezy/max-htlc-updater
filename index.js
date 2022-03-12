const child_process = require('child_process')

const LNCLI = `/home/ubuntu/lnd/lncli`

const DRY_RUN = process.argv.length > 2 && process.argv[2] == '--dry-run'

if (DRY_RUN) {
    console.log(`\n~ DRY RUN ~\n`)
}

const UPPER_BOUND = 0.9
const LOWER_BOUND = 0.1

function lncli(command) {
    return JSON.parse(child_process.execSync(`${LNCLI} ${command}`))
}

const nodeInfo = lncli('getinfo')

function getPolicy(chanInfo) {
    if (chanInfo.node1_pub === nodeInfo.identity_pubkey) {
        return chanInfo.node1_policy
    }
    if (chanInfo.node2_pub === nodeInfo.identity_pubkey) {
        return chanInfo.node2_policy
    }
    throw new Error(`Unexpected channel info. Expected to see pubkey ${nodeInfo.identity_pubkey} but found ${chanInfo.node1_pub} and ${chanInfo.node2_pub}`)
}


const listChannels = lncli('listchannels')

function withExisting(policy) {
    return `--base_fee ${policy.fee_base_msat} --fee_rate ${policy.fee_rate_milli_msat / 1000000.0} --time_lock_delta ${policy.time_lock_delta} ${policy.chan_point}`
}

function resetMaxHtlc(policy, newMaxHtlcMsat) {
    const command = `updatechanpolicy --max_htlc_msat ${newMaxHtlcMsat} ${withExisting(policy)}`
    console.log(`Running: ${command}`)
    if (!DRY_RUN) {
        const response = lncli(command)
        console.log(response)
    }
}

for (const channel of listChannels.channels) {
    const localBalanceMsats = parseInt(channel.local_balance) * 1000
    const chanInfo = lncli(`getchaninfo ${channel.chan_id}`)
    const policy = getPolicy(chanInfo)

    console.log(`channel ${chanInfo.chan_id}, maxHtlcMsat: ${policy.maxHtlcMsat}, localBalanceMsats: ${localBalanceMsats}`)
    if (policy.maxHtlcMsat > UPPER_BOUND * localBalanceMsats || policy.maxHtlcMsat < LOWER_BOUND * localBalanceMsats) {
        resetMaxHtlc(policy, localBalanceMsats / 2)
    }


}
