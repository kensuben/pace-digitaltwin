import { getTopology } from "@/server/services/topologyService";
import type { TopologyRepository } from "@/server/repositories/topologyRepository";
import { AppError } from "@/server/errors";
import { getPrismaClient } from "@/server/db/client";

type StructureDevice = Awaited<ReturnType<typeof getTopology>>["devices"][number];

export function calculateNetworkStructureData(devices: StructureDevice[], links: Array<{ sourcePort: { deviceInstanceId: string }; targetPort: { deviceInstanceId: string } }>) {
  const floors = [...new Map(devices.map((device) => [device.floor.id, device.floor])).values()].sort((a,b)=>a.level-b.level);
  const connected = new Set(links.flatMap((link)=>[link.sourcePort.deviceInstanceId,link.targetPort.deviceInstanceId]));
  const unconnectedDevices = devices.filter((device)=>!connected.has(device.id)).length;
  const readinessScore = devices.length ? Math.round((connected.size / devices.length) * 100) : 0;
  const vlans = [
    { vlanId: 10, name: "MANAGEMENT", cidr: "10.181.10.0/24", purpose: "Switch, firewall và hạ tầng quản trị" },
    { vlanId: 20, name: "SERVER", cidr: "10.181.20.0/24", purpose: "Server, NAS, NVR và dịch vụ nội bộ" },
    { vlanId: 30, name: "SECURITY", cidr: "10.181.30.0/23", purpose: "Camera, access control và IoT an ninh" },
    { vlanId: 40, name: "CORPORATE-WIFI", cidr: "10.181.40.0/22", purpose: "Wi-Fi nhân viên và thiết bị quản lý" },
    { vlanId: 50, name: "GUEST-WIFI", cidr: "10.181.44.0/22", purpose: "Khách, Internet-only và client isolation" },
    ...floors.filter((floor)=>floor.code.toUpperCase()!=="B2").map((floor,index)=>({ vlanId: 100+index, name: `USER-${floor.code}`, cidr: `10.181.${100+index}.0/24`, purpose: `Thiết bị người dùng tại ${floor.name}` })),
  ];
  const recommendations = [
    "Giữ Core/Firewall tại B2 làm điểm hội tụ; mỗi tầng tối thiểu một uplink về Core.",
    "Tách Management, Server, Security, Corporate Wi-Fi và Guest Wi-Fi bằng VLAN riêng.",
    floors.length > 1 ? `Cấp một subnet /24 riêng cho mỗi tầng (${floors.filter((floor)=>floor.code.toUpperCase()!=="B2").length} tầng sử dụng).` : "Bổ sung thông tin tầng để đề xuất subnet theo khu vực.",
    unconnectedDevices ? `${unconnectedDevices} thiết bị chưa có đường vật lý; hoàn tất mapping trước khi phê duyệt capacity.` : "Toàn bộ thiết bị đã tham gia topology vật lý.",
  ];
  return { readinessScore, summary: { floors: floors.length, devices: devices.length, links: links.length, unconnectedDevices }, vlans, recommendations };
}

export async function calculateNetworkStructure(scenarioId: string, repository?: TopologyRepository) {
  const topology = await getTopology(scenarioId, repository);
  return calculateNetworkStructureData(topology.devices, topology.links);
}

export async function approveNetworkStructure(scenarioId: string) {
  const prisma = getPrismaClient();
  const scenario = await prisma.scenario.findUnique({ where: { id: scenarioId }, select: { id: true, isLocked: true } });
  if (!scenario) throw new AppError("SCENARIO_NOT_FOUND", "Scenario was not found.", 404);
  if (scenario.isLocked) throw new AppError("SCENARIO_LOCKED", "Locked scenarios cannot be changed.", 409);
  const proposal = await calculateNetworkStructure(scenarioId);
  let createdVlans=0, updatedVlans=0, createdSubnets=0, updatedSubnets=0;
  await prisma.$transaction(async (tx)=>{
    for (const item of proposal.vlans) {
      const existingVlan=await tx.vlan.findUnique({where:{scenarioId_vlanId:{scenarioId,vlanId:item.vlanId}}});
      const vlan=existingVlan
        ? await tx.vlan.update({where:{id:existingVlan.id},data:{name:item.name,purpose:item.purpose}})
        : await tx.vlan.create({data:{scenarioId,vlanId:item.vlanId,name:item.name,purpose:item.purpose}});
      if (existingVlan) updatedVlans++;
      else createdVlans++;
      const existingSubnet=await tx.subnet.findFirst({where:{scenarioId,cidr:item.cidr,vrf:null}});
      if(existingSubnet){await tx.subnet.update({where:{id:existingSubnet.id},data:{vlanId:vlan.id,name:item.name,description:item.purpose}});updatedSubnets++}
      else{await tx.subnet.create({data:{scenarioId,vlanId:vlan.id,name:item.name,cidr:item.cidr,gateway:item.cidr.replace(/\.0\/\d+$/,".1"),description:item.purpose}});createdSubnets++}
    }
  });
  return {createdVlans,updatedVlans,createdSubnets,updatedSubnets,total:proposal.vlans.length};
}
